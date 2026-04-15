import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { addDoc, collection, deleteDoc, doc, getFirestore, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { firebaseConfig, appMeta } from "./firebase-config.js";

const state = {
  view: "home",
  section: "dash",
  restaurantId: null,
  restaurants: [],
  ingredients: [],
  recipes: [],
  ingredientEntries: [],
  productionEntries: [],
  deliveryEntries: [],
  unsubscribers: [],
  flash: "",
};

const appEl = document.querySelector("#app");
const fmt = (n) => Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 2 });
const fmtDate = (value) => {
  if (!value) return "—";
  const date = value?.toDate ? value.toDate() : new Date(value);
  return date.toLocaleDateString("es-AR");
};
const today = () => new Date().toISOString().slice(0, 10);
const okConfig = Object.values(firebaseConfig).every((v) => v && !String(v).startsWith("REEMPLAZAR_"));

if (!okConfig) {
  appEl.innerHTML = `<div class="boot-screen"><div class="boot-card"><div class="brand">Lingüine Mayorista</div><p class="boot-message">Completá <strong>firebase-config.js</strong> con tus credenciales.</p></div></div>`;
  throw new Error("Firebase config incompleta");
}

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const restaurantsRef = collection(db, "apps", appMeta.appName, "restaurants");

const restaurantCollection = (name) => collection(db, "apps", appMeta.appName, "restaurants", state.restaurantId, name);
const activeRestaurant = () => state.restaurants.find((r) => r.id === state.restaurantId);

function getDateValue(value) {
  if (!value) return 0;
  if (value?.toDate) return value.toDate().getTime();
  return new Date(value).getTime();
}

function flash(message) {
  state.flash = message;
  render();
  clearTimeout(flash.timer);
  flash.timer = setTimeout(() => {
    state.flash = "";
    render();
  }, 2200);
}

function stopListeners() {
  state.unsubscribers.forEach((fn) => fn());
  state.unsubscribers = [];
}

function stockMP() {
  const map = Object.fromEntries(state.ingredients.map((i) => [i.id, 0]));
  state.ingredientEntries.forEach((x) => map[x.ingId] = (map[x.ingId] || 0) + Number(x.cantidad || 0));
  state.productionEntries.forEach((p) => {
    const rec = state.recipes.find((r) => r.id === p.recId);
    (rec?.ings || []).forEach((ri) => {
      map[ri.ingId] = (map[ri.ingId] || 0) - Number(ri.cant || 0) * Number(p.lotes || 0);
    });
  });
  return map;
}

function stockProd() {
  const map = Object.fromEntries(state.recipes.map((r) => [r.id, { por: 0, kg: 0 }]));
  state.productionEntries.forEach((p) => {
    if (!map[p.recId]) map[p.recId] = { por: 0, kg: 0 };
    map[p.recId].por += Number(p.por || 0);
    map[p.recId].kg += Number(p.kg || 0);
  });
  state.deliveryEntries.forEach((e) => {
    if (!map[e.recId]) map[e.recId] = { por: 0, kg: 0 };
    if (e.tipo === "por") map[e.recId].por -= Number(e.cant || 0);
    else map[e.recId].kg -= Number(e.cant || 0);
  });
  return map;
}

function badge(text, kind) {
  return `<span class="badge ${kind}">${text}</span>`;
}

function table(headers, rows) {
  if (!rows.length) return `<div class="empty">Sin registros todavía</div>`;
  return `<div class="table-wrap"><table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function homeHtml() {
  return `
    <section class="home">
      <div class="home-title">Lingüine Mayorista</div>
      <div class="home-subtitle">Sistema Web con Firebase</div>
      <div class="restaurant-grid">
        ${state.restaurants.map((r) => `
          <article class="restaurant-card" style="--rcolor:${r.color || "#c4552a"}" data-open="${r.id}">
            <span class="restaurant-emoji">${r.emoji || "🍝"}</span>
            <div class="restaurant-name">${r.nombre}</div>
            <div class="restaurant-desc">${r.desc || ""}</div>
          </article>
        `).join("")}
        <button class="restaurant-card add-card" id="newRestaurantBtn">＋ Agregar restaurante</button>
      </div>
    </section>
  `;
}

function dashboardHtml() {
  const smp = stockMP();
  const spr = stockProd();
  const low = state.ingredients.filter((i) => (smp[i.id] || 0) > 0 && Number(i.min || 0) > 0 && (smp[i.id] || 0) < Number(i.min || 0)).length;
  const out = state.ingredients.filter((i) => (smp[i.id] || 0) <= 0).length;
  return `
    <div class="stats">
      <div class="stat-card"><label>Materias primas</label><strong>${state.ingredients.length}</strong></div>
      <div class="stat-card"><label>Recetas</label><strong>${state.recipes.length}</strong></div>
      <div class="stat-card"><label>Producciones</label><strong>${state.productionEntries.length}</strong></div>
      <div class="stat-card"><label>Entregas</label><strong>${state.deliveryEntries.length}</strong></div>
    </div>
    <div class="stats">
      <div class="stat-card"><label>Stock bajo</label><strong>${low}</strong></div>
      <div class="stat-card"><label>Sin stock</label><strong>${out}</strong></div>
      <div class="stat-card"><label>Ingresos MP</label><strong>${state.ingredientEntries.length}</strong></div>
      <div class="stat-card"><label>Prod. con stock</label><strong>${Object.values(spr).filter((s) => s.por > 0 || s.kg > 0).length}</strong></div>
    </div>
    <div class="split">
      <div class="panel">
        <h3>Últimas producciones</h3>
        ${table(["Fecha","Plato","Lotes","Porciones","Kg"], state.productionEntries.slice().sort((a,b) => getDateValue(b.fecha)-getDateValue(a.fecha)).slice(0,8).map((p) => {
          const rec = state.recipes.find((r) => r.id === p.recId);
          return [fmtDate(p.fecha), rec?.nombre || "—", p.lotes || "—", fmt(p.por), fmt(p.kg)];
        }))}
      </div>
      <div class="panel">
        <h3>Stock de materias primas</h3>
        ${table(["Ingrediente","Stock","Estado"], state.ingredients.map((i) => {
          const s = smp[i.id] || 0;
          const min = Number(i.min || 0);
          const status = s <= 0 ? badge("SIN STOCK", "out") : min > 0 && s < min ? badge("BAJO", "low") : badge("OK", "ok");
          return [i.nombre, `${fmt(s)} ${i.unidad || ""}`, status];
        }))}
      </div>
    </div>
  `;
}

function ingredientsHtml() {
  const smp = stockMP();
  return `<div class="panel"><div class="toolbar" style="margin-bottom:12px"><button class="primary-btn" id="addIngredientBtn">+ Nuevo ingrediente</button></div>${table(["Ingrediente","Unidad","Precio","Stock","Mínimo","Estado","Acciones"], state.ingredients.map((i) => {
    const s = smp[i.id] || 0;
    const min = Number(i.min || 0);
    const status = s <= 0 ? badge("SIN STOCK","out") : min > 0 && s < min ? badge("BAJO","low") : badge("OK","ok");
    return [i.nombre, i.unidad || "—", i.precio ? `$${fmt(i.precio)}` : "—", fmt(s), i.min || "—", status, `<div class="row-actions"><button class="ghost-btn" data-edit-ingredient="${i.id}">Editar</button><button class="danger-btn" data-delete-ingredient="${i.id}">Borrar</button></div>`];
  }))}</div>`;
}

function recipesHtml() {
  return `<div class="panel"><div class="toolbar" style="margin-bottom:12px"><button class="primary-btn" id="addRecipeBtn">+ Nueva receta</button></div>${table(["Plato","g/porción","Ingredientes","Acciones"], state.recipes.map((r) => [r.nombre, r.gpor || "—", (r.ings || []).map((ri) => {
    const ing = state.ingredients.find((i) => i.id === ri.ingId);
    return `${ing?.nombre || "—"} (${ri.cant} ${ing?.unidad || ""})`;
  }).join(", "), `<div class="row-actions"><button class="ghost-btn" data-edit-recipe="${r.id}">Editar</button><button class="danger-btn" data-delete-recipe="${r.id}">Borrar</button></div>`]))}</div>`;
}

function entriesHtml() {
  return `
    <div class="double">
      <div class="panel">
        <h3>Registrar ingreso</h3>
        <form id="ingredientEntryForm" class="form-grid">
          <div class="field"><label>Ingrediente</label><select name="ingId">${state.ingredients.map((i) => `<option value="${i.id}">${i.nombre}</option>`).join("")}</select></div>
          <div class="field"><label>Cantidad</label><input name="cantidad" type="number" step="any" required></div>
          <div class="field"><label>Costo</label><input name="costo" type="number" step="any"></div>
          <div class="field"><label>Proveedor</label><input name="prov"></div>
          <div class="field"><label>Fecha</label><input name="fecha" type="date" value="${today()}"></div>
          <div class="field full"><label>Nota</label><input name="nota"></div>
          <div class="field"><button class="primary-btn" type="submit">Guardar ingreso</button></div>
        </form>
      </div>
      <div class="panel">
        <h3>Historial</h3>
        ${table(["Fecha","Ingrediente","Cantidad","Costo","Proveedor"], state.ingredientEntries.slice().sort((a,b) => getDateValue(b.fecha)-getDateValue(a.fecha)).map((x) => {
          const ing = state.ingredients.find((i) => i.id === x.ingId);
          return [fmtDate(x.fecha), ing?.nombre || "—", `${fmt(x.cantidad)} ${ing?.unidad || ""}`, x.costo ? `$${fmt(x.costo)}` : "—", x.prov || "—"];
        }))}
      </div>
    </div>
  `;
}

function productionHtml() {
  return `
    <div class="double">
      <div class="panel">
        <h3>Registrar producción</h3>
        <form id="productionForm" class="form-grid">
          <div class="field"><label>Receta</label><select name="recId">${state.recipes.map((r) => `<option value="${r.id}">${r.nombre}</option>`).join("")}</select></div>
          <div class="field"><label>Lotes</label><input name="lotes" type="number" step="1" required></div>
          <div class="field"><label>Peso kg</label><input name="kg" type="number" step="any"></div>
          <div class="field"><label>Porciones</label><input name="por" type="number" step="1"></div>
          <div class="field"><label>Tiempo real (min)</label><input name="treal" type="number"></div>
          <div class="field"><label>Fecha</label><input name="fecha" type="date" value="${today()}"></div>
          <div class="field full"><label>Nota</label><input name="nota"></div>
          <div class="field"><button class="primary-btn" type="submit">Guardar producción</button></div>
        </form>
        <div class="helper">La producción descuenta materias primas según la receta.</div>
      </div>
      <div class="panel">
        <h3>Historial</h3>
        ${table(["Fecha","Plato","Lotes","Porciones","Kg"], state.productionEntries.slice().sort((a,b) => getDateValue(b.fecha)-getDateValue(a.fecha)).map((p) => {
          const rec = state.recipes.find((r) => r.id === p.recId);
          return [fmtDate(p.fecha), rec?.nombre || "—", p.lotes || "—", fmt(p.por), fmt(p.kg)];
        }))}
      </div>
    </div>
  `;
}

function deliveriesHtml() {
  return `
    <div class="double">
      <div class="panel">
        <h3>Registrar entrega</h3>
        <form id="deliveryForm" class="form-grid">
          <div class="field"><label>Receta</label><select name="recId">${state.recipes.map((r) => `<option value="${r.id}">${r.nombre}</option>`).join("")}</select></div>
          <div class="field"><label>Tipo</label><select name="tipo"><option value="por">Porciones</option><option value="kg">Peso (kg)</option></select></div>
          <div class="field"><label>Cantidad</label><input name="cant" type="number" step="any" required></div>
          <div class="field"><label>Destinatario</label><input name="dest"></div>
          <div class="field"><label>Fecha</label><input name="fecha" type="date" value="${today()}"></div>
          <div class="field full"><label>Nota</label><input name="nota"></div>
          <div class="field"><button class="primary-btn" type="submit">Guardar entrega</button></div>
        </form>
      </div>
      <div class="panel">
        <h3>Historial</h3>
        ${table(["Fecha","Plato","Tipo","Cantidad","Destino"], state.deliveryEntries.slice().sort((a,b) => getDateValue(b.fecha)-getDateValue(a.fecha)).map((e) => {
          const rec = state.recipes.find((r) => r.id === e.recId);
          return [fmtDate(e.fecha), rec?.nombre || "—", e.tipo === "por" ? "Porciones" : "Kg", fmt(e.cant), e.dest || "—"];
        }))}
      </div>
    </div>
  `;
}

function stockHtml() {
  const smp = stockMP();
  const spr = stockProd();
  return `
    <div class="double">
      <div class="panel">
        <h3>Materias primas</h3>
        ${table(["Ingrediente","Stock","Mínimo","Estado"], state.ingredients.map((i) => {
          const s = smp[i.id] || 0;
          const min = Number(i.min || 0);
          const status = s <= 0 ? badge("SIN STOCK","out") : min > 0 && s < min ? badge("BAJO","low") : badge("OK","ok");
          return [i.nombre, `${fmt(s)} ${i.unidad || ""}`, i.min || "—", status];
        }))}
      </div>
      <div class="panel">
        <h3>Productos terminados</h3>
        ${table(["Plato","Porciones","Kg"], state.recipes.map((r) => {
          const s = spr[r.id] || { por: 0, kg: 0 };
          return [r.nombre, fmt(s.por), fmt(s.kg)];
        }))}
      </div>
    </div>
  `;
}

function infoHtml() {
  const mpCost = state.ingredientEntries.reduce((a, x) => a + Number(x.costo || 0), 0);
  const por = state.productionEntries.reduce((a, x) => a + Number(x.por || 0), 0);
  const kg = state.productionEntries.reduce((a, x) => a + Number(x.kg || 0), 0);
  const summary = [`Informe de ${activeRestaurant()?.nombre || ""}`, `Materias primas: ${state.ingredients.length}`, `Recetas: ${state.recipes.length}`, `Ingresos MP: ${state.ingredientEntries.length}`, `Producciones: ${state.productionEntries.length}`, `Entregas: ${state.deliveryEntries.length}`].join("\n");
  return `
    <div class="stats">
      <div class="stat-card"><label>Costo total MP</label><strong>$${fmt(mpCost)}</strong></div>
      <div class="stat-card"><label>Porciones producidas</label><strong>${fmt(por)}</strong></div>
      <div class="stat-card"><label>Kg producidos</label><strong>${fmt(kg)}</strong></div>
      <div class="stat-card"><label>Entregas</label><strong>${state.deliveryEntries.length}</strong></div>
    </div>
    <div class="panel"><h3>Resumen</h3><div class="code-box" id="summaryText">${summary}</div><div class="toolbar" style="margin-top:12px"><button class="primary-btn" id="copySummaryBtn">Copiar informe</button></div></div>
  `;
}

function appHtml() {
  const sectionTitles = {
    dash: ["Dashboard","Resumen general del restaurante"],
    ings: ["Materias primas","Ingredientes, unidad, mínimo y precio"],
    recs: ["Recetas","Platos y consumo por lote"],
    ingresos: ["Ingreso de materias primas","Compras y abastecimiento"],
    prod: ["Producción","Registro de lotes y porciones"],
    ent: ["Entregas","Salidas por porciones o peso"],
    stock: ["Stock","Estado actual de materias primas y producto terminado"],
    info: ["Informes","Resumen exportable del restaurante"],
  };
  const renderer = { dash: dashboardHtml, ings: ingredientsHtml, recs: recipesHtml, ingresos: entriesHtml, prod: productionHtml, ent: deliveriesHtml, stock: stockHtml, info: infoHtml }[state.section];
  const rest = activeRestaurant();
  return `
    <div class="layout">
      <aside class="sidebar">
        <div class="sidebar-title">${rest?.emoji || "🍝"} ${rest?.nombre || ""}</div>
        <div class="sidebar-desc">${rest?.desc || "Gestión de operaciones"}</div>
        ${Object.keys(sectionTitles).map((key) => `<button class="nav-btn ${state.section === key ? "active" : ""}" data-nav="${key}">${sectionTitles[key][0]}</button>`).join("")}
        <button class="back-btn" id="goHomeBtn">← Volver al inicio</button>
      </aside>
      <main class="main">
        ${state.flash ? `<div class="flash ok">${state.flash}</div>` : ""}
        <div class="page-head"><div><div class="page-title">${sectionTitles[state.section][0]}</div><div class="page-subtitle">${sectionTitles[state.section][1]}</div></div></div>
        ${renderer()}
      </main>
    </div>
  `;
}

function render() {
  appEl.innerHTML = state.view === "home" ? homeHtml() : appHtml();
  bindEvents();
}

function bindEvents() {
  document.querySelectorAll("[data-open]").forEach((el) => el.onclick = () => openRestaurant(el.dataset.open));
  const newRestaurantBtn = document.querySelector("#newRestaurantBtn");
  if (newRestaurantBtn) newRestaurantBtn.onclick = createRestaurant;
  document.querySelectorAll("[data-nav]").forEach((el) => el.onclick = () => { state.section = el.dataset.nav; render(); });
  const goHomeBtn = document.querySelector("#goHomeBtn");
  if (goHomeBtn) goHomeBtn.onclick = () => { stopListeners(); state.view = "home"; state.restaurantId = null; render(); };
  const addIngredientBtn = document.querySelector("#addIngredientBtn");
  if (addIngredientBtn) addIngredientBtn.onclick = createIngredient;
  const addRecipeBtn = document.querySelector("#addRecipeBtn");
  if (addRecipeBtn) addRecipeBtn.onclick = createRecipe;
  const ingredientEntryForm = document.querySelector("#ingredientEntryForm");
  if (ingredientEntryForm) ingredientEntryForm.onsubmit = saveIngredientEntry;
  const productionForm = document.querySelector("#productionForm");
  if (productionForm) productionForm.onsubmit = saveProduction;
  const deliveryForm = document.querySelector("#deliveryForm");
  if (deliveryForm) deliveryForm.onsubmit = saveDelivery;
  const copySummaryBtn = document.querySelector("#copySummaryBtn");
  if (copySummaryBtn) copySummaryBtn.onclick = async () => { await navigator.clipboard.writeText(document.querySelector("#summaryText").textContent); flash("Informe copiado."); };
  document.querySelectorAll("[data-edit-ingredient]").forEach((el) => el.onclick = () => editIngredient(el.dataset.editIngredient));
  document.querySelectorAll("[data-delete-ingredient]").forEach((el) => el.onclick = () => removeIngredient(el.dataset.deleteIngredient));
  document.querySelectorAll("[data-edit-recipe]").forEach((el) => el.onclick = () => editRecipe(el.dataset.editRecipe));
  document.querySelectorAll("[data-delete-recipe]").forEach((el) => el.onclick = () => removeRecipe(el.dataset.deleteRecipe));
}

async function createRestaurant() {
  const nombre = prompt("Nombre del restaurante");
  if (!nombre) return;
  const emoji = prompt("Emoji", "🍝") || "🍝";
  const desc = prompt("Descripción", "Nueva sucursal") || "";
  const color = prompt("Color HEX", "#C4552A") || "#C4552A";
  await addDoc(restaurantsRef, { nombre, emoji, desc, color, createdAt: serverTimestamp() });
  flash("Restaurante creado.");
}

async function createIngredient() {
  const nombre = prompt("Nombre del ingrediente");
  if (!nombre) return;
  const unidad = prompt("Unidad", "kg") || "kg";
  const min = prompt("Stock mínimo", "0") || "0";
  const precio = prompt("Precio por unidad", "0") || "0";
  await addDoc(restaurantCollection("ingredients"), { nombre, unidad, min, precio, createdAt: serverTimestamp() });
  flash("Ingrediente guardado.");
}

async function editIngredient(id) {
  const item = state.ingredients.find((x) => x.id === id);
  if (!item) return;
  const nombre = prompt("Nombre", item.nombre);
  if (!nombre) return;
  const unidad = prompt("Unidad", item.unidad || "kg") || item.unidad || "kg";
  const min = prompt("Mínimo", item.min || "0") || item.min || "0";
  const precio = prompt("Precio", item.precio || "0") || item.precio || "0";
  await updateDoc(doc(restaurantCollection("ingredients"), id), { nombre, unidad, min, precio, updatedAt: serverTimestamp() });
  flash("Ingrediente actualizado.");
}

async function removeIngredient(id) {
  if (!confirm("¿Eliminar este ingrediente?")) return;
  await deleteDoc(doc(restaurantCollection("ingredients"), id));
  flash("Ingrediente eliminado.");
}

async function createRecipe() {
  if (!state.ingredients.length) return flash("Primero cargá materias primas.");
  const nombre = prompt("Nombre de la receta");
  if (!nombre) return;
  const gpor = prompt("Gramos por porción", "200") || "";
  const base = `${state.ingredients[0].nombre}:1`;
  const raw = prompt("Ingredientes por lote. Formato: nombre:cantidad, nombre:cantidad", base) || "";
  const ings = raw.split(",").map((x) => x.trim()).filter(Boolean).map((pair) => {
    const [name, cant] = pair.split(":").map((x) => x.trim());
    const ing = state.ingredients.find((i) => i.nombre.toLowerCase() === name.toLowerCase());
    return ing ? { ingId: ing.id, cant } : null;
  }).filter(Boolean);
  await addDoc(restaurantCollection("recipes"), { nombre, gpor, ings, createdAt: serverTimestamp() });
  flash("Receta creada.");
}

async function editRecipe(id) {
  const item = state.recipes.find((x) => x.id === id);
  if (!item) return;
  const nombre = prompt("Nombre", item.nombre);
  if (!nombre) return;
  const gpor = prompt("Gramos por porción", item.gpor || "") || item.gpor || "";
  await updateDoc(doc(restaurantCollection("recipes"), id), { nombre, gpor, updatedAt: serverTimestamp() });
  flash("Receta actualizada.");
}

async function removeRecipe(id) {
  if (!confirm("¿Eliminar esta receta?")) return;
  await deleteDoc(doc(restaurantCollection("recipes"), id));
  flash("Receta eliminada.");
}

async function saveIngredientEntry(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  await addDoc(restaurantCollection("ingredientEntries"), { ingId: form.get("ingId"), cantidad: Number(form.get("cantidad") || 0), costo: Number(form.get("costo") || 0), prov: form.get("prov") || "", nota: form.get("nota") || "", fecha: new Date(form.get("fecha")), createdAt: serverTimestamp() });
  event.currentTarget.reset();
  event.currentTarget.fecha.value = today();
  flash("Ingreso registrado.");
}

async function saveProduction(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const recId = form.get("recId");
  const recipe = state.recipes.find((r) => r.id === recId);
  const lotes = Number(form.get("lotes") || 0);
  const available = stockMP();
  const enough = (recipe?.ings || []).every((ri) => (available[ri.ingId] || 0) >= Number(ri.cant || 0) * lotes);
  if (!enough) return flash("No hay stock suficiente de materias primas.");
  let por = Number(form.get("por") || 0);
  const kg = Number(form.get("kg") || 0);
  if (!por && recipe?.gpor && kg) por = Math.floor((kg * 1000) / Number(recipe.gpor));
  await addDoc(restaurantCollection("productionEntries"), { recId, lotes, kg, por, treal: Number(form.get("treal") || 0), nota: form.get("nota") || "", fecha: new Date(form.get("fecha")), createdAt: serverTimestamp() });
  event.currentTarget.reset();
  event.currentTarget.fecha.value = today();
  flash("Producción registrada.");
}

async function saveDelivery(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const recId = form.get("recId");
  const tipo = form.get("tipo");
  const cant = Number(form.get("cant") || 0);
  const available = stockProd()[recId] || { por: 0, kg: 0 };
  const max = tipo === "por" ? available.por : available.kg;
  if (cant > max) return flash("No hay stock suficiente de producto terminado.");
  await addDoc(restaurantCollection("deliveryEntries"), { recId, tipo, cant, dest: form.get("dest") || "", nota: form.get("nota") || "", fecha: new Date(form.get("fecha")), createdAt: serverTimestamp() });
  event.currentTarget.reset();
  event.currentTarget.fecha.value = today();
  flash("Entrega registrada.");
}

function openRestaurant(id) {
  state.restaurantId = id;
  state.view = "app";
  state.section = "dash";
  stopListeners();
  state.unsubscribers = [
    onSnapshot(query(restaurantCollection("ingredients"), orderBy("nombre")), (snap) => { state.ingredients = snap.docs.map((d) => ({ id: d.id, ...d.data() })); render(); }),
    onSnapshot(query(restaurantCollection("recipes"), orderBy("nombre")), (snap) => { state.recipes = snap.docs.map((d) => ({ id: d.id, ...d.data() })); render(); }),
    onSnapshot(query(restaurantCollection("ingredientEntries"), orderBy("fecha", "desc")), (snap) => { state.ingredientEntries = snap.docs.map((d) => ({ id: d.id, ...d.data() })); render(); }),
    onSnapshot(query(restaurantCollection("productionEntries"), orderBy("fecha", "desc")), (snap) => { state.productionEntries = snap.docs.map((d) => ({ id: d.id, ...d.data() })); render(); }),
    onSnapshot(query(restaurantCollection("deliveryEntries"), orderBy("fecha", "desc")), (snap) => { state.deliveryEntries = snap.docs.map((d) => ({ id: d.id, ...d.data() })); render(); }),
  ];
  render();
}

onSnapshot(query(restaurantsRef, orderBy("nombre")), (snap) => {
  state.restaurants = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (state.restaurantId && !state.restaurants.some((r) => r.id === state.restaurantId)) {
    stopListeners();
    state.view = "home";
    state.restaurantId = null;
  }
  render();
});

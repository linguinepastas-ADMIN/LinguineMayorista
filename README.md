# Lingüine Mayorista

Esta versión está preparada para web con Firebase Firestore.

## Archivos nuevos

- `firebase.html`: entrada de la app web
- `styles.css`: estilos compartidos
- `firebase-config.js`: credenciales del proyecto Firebase
- `app.js`: lógica conectada a Firestore

## Qué falta completar

1. Reemplazá los valores de `firebase-config.js` por los de tu app web de Firebase.
2. Publicá estos archivos en tu repo GitHub.
3. Desplegá el sitio en Firebase Hosting, Vercel, Netlify o GitHub Pages.

## Estructura de Firestore

- `apps/linguine-mayorista/restaurants/{restaurantId}`
- `apps/linguine-mayorista/restaurants/{restaurantId}/ingredients/{ingredientId}`
- `apps/linguine-mayorista/restaurants/{restaurantId}/recipes/{recipeId}`
- `apps/linguine-mayorista/restaurants/{restaurantId}/ingredientEntries/{entryId}`
- `apps/linguine-mayorista/restaurants/{restaurantId}/productionEntries/{entryId}`
- `apps/linguine-mayorista/restaurants/{restaurantId}/deliveryEntries/{entryId}`

## Nota

Si querés que esta sea la página principal del sitio, renombrá `firebase.html` a `index.html` dentro del repo antes de desplegar.

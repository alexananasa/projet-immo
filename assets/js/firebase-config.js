// La configuration Firebase est publique dans une application Web.
// Elle identifie le projet ; elle ne contient pas de clé privée.
// Remplace les valeurs REPLACE_* par la configuration de l'application Web Firebase.
export const firebaseConfig = {
  apiKey: "REPLACE_WITH_FIREBASE_API_KEY",
  authDomain: "REPLACE_WITH_PROJECT_ID.firebaseapp.com",
  projectId: "REPLACE_WITH_PROJECT_ID",
  appId: "REPLACE_WITH_FIREBASE_APP_ID"
};

export const firebaseReady = Object.values(firebaseConfig).every(
  (value) => typeof value === "string" && value.length > 0 && !value.startsWith("REPLACE_")
);

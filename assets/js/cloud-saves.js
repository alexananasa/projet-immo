import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithRedirect,
  getRedirectResult,
  signOut
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  getDocs,
  addDoc,
  doc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { firebaseConfig, firebaseReady } from "./firebase-config.js";

(() => {
  "use strict";

  const signInButton = document.getElementById("googleSignIn");
  const signOutButton = document.getElementById("googleSignOut");
  const accountStatus = document.getElementById("cloudAccountStatus");
  const cloudStatus = document.getElementById("cloudStatus");
  const saveForm = document.getElementById("saveAnalysisForm");
  const nameInput = document.getElementById("analysisName");
  const saveButton = document.getElementById("saveAnalysisButton");
  const emptyState = document.getElementById("savedEmpty");
  const savedList = document.getElementById("savedList");
  const appInputs = [...document.querySelectorAll("[data-field]")];
  let auth;
  let db;
  let currentUser = null;
  let busy = false;

  const money = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  });
  const shortDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

  function setStatus(message, isError = false) {
    cloudStatus.textContent = message;
    cloudStatus.classList.toggle("cloud-status--error", isError);
  }

  function setBusy(value) {
    busy = value;
    saveButton.disabled = value || !currentUser;
    signInButton.disabled = value || !firebaseReady;
    signOutButton.disabled = value || !currentUser;
  }

  function explainError(error) {
    const code = error && error.code ? error.code : "";
    if (code === "auth/unauthorized-domain") {
      return "Ce domaine doit être ajouté aux domaines autorisés de Firebase Authentication.";
    }
    if (code === "auth/operation-not-allowed") {
      return "La connexion Google n’est pas encore activée dans Firebase Authentication.";
    }
    if (code === "permission-denied" || code === "firestore/permission-denied") {
      return "Firebase a refusé l’accès. Vérifie les règles Firestore du projet.";
    }
    if (code === "unavailable") {
      return "Le service Firebase est temporairement indisponible. Réessaie dans un instant.";
    }
    return "Une erreur Firebase est survenue. Vérifie la configuration du projet puis réessaie.";
  }

  function readAnalysis() {
    const inputs = {};
    appInputs.forEach((input) => {
      const parsed = input.value.trim() === "" ? 0 : Number(input.value);
      inputs[input.dataset.field] = Number.isFinite(parsed) ? parsed : 0;
    });
    return {
      inputs,
      projectionScenario: document.getElementById("projectionScenario").value
    };
  }

  function getCashflows(values) {
    const notary = values.purchasePrice < 100000
      ? values.purchasePrice * 0.10
      : values.purchasePrice * 0.08;
    const guaranteeBase = values.purchasePrice + values.agencyFees + notary
      + values.works + values.dossierFees;
    const operationCost = guaranteeBase + guaranteeBase * 0.015 + values.brokerageFees;
    const principal = Math.max(0, operationCost - values.contribution);
    const months = Math.max(1, Math.round(values.loanYears * 12));
    const monthlyRate = values.interestRate / 100 / 12;
    const payment = monthlyRate === 0
      ? principal / months
      : principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -months));
    const sharedExpenses = payment + values.propertyTaxAnnual / 12
      + values.coproAnnual / 12 + values.loanInsurance + values.pnoInsurance;
    const standard = values.standardRent + values.standardTenantCharges
      - sharedExpenses - values.standardCfeAnnual / 12;
    const colocation = values.roomRent * values.roomCount
      - sharedExpenses - values.internet - values.electricity - values.water
      - values.homeInsurance - values.cleaning - values.colocCfeAnnual / 12;
    return { standard, colocation };
  }

  function makeMetric(label, value) {
    const wrapper = document.createElement("div");
    wrapper.className = "saved-card__metric";
    const title = document.createElement("span");
    title.textContent = label;
    const detail = document.createElement("strong");
    detail.textContent = value;
    wrapper.append(title, detail);
    return wrapper;
  }

  function makeButton(label, className, action) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    button.addEventListener("click", action);
    return button;
  }

  function savedDate(record) {
    const timestamp = record.updatedAt || record.createdAt;
    if (!timestamp || typeof timestamp.toDate !== "function") return "Enregistré récemment";
    return "Enregistré le " + shortDate.format(timestamp.toDate());
  }

  function renderSavedItem(snapshot) {
    const record = snapshot.data();
    const card = document.createElement("article");
    card.className = "saved-card";

    const header = document.createElement("div");
    header.className = "saved-card__heading";
    const heading = document.createElement("h3");
    heading.textContent = typeof record.name === "string" && record.name.trim()
      ? record.name
      : "Bien immobilier";
    const date = document.createElement("p");
    date.textContent = savedDate(record);
    header.append(heading, date);

    const metrics = document.createElement("div");
    metrics.className = "saved-card__metrics";
    metrics.append(
      makeMetric("Prix d’achat", money.format(Number(record.purchasePrice) || 0)),
      makeMetric("Cash-flow · standard", money.format(Number(record.standardCashflow) || 0)),
      makeMetric("Cash-flow · colocation", money.format(Number(record.colocationCashflow) || 0))
    );

    const actions = document.createElement("div");
    actions.className = "saved-card__actions";
    actions.append(
      makeButton("Ouvrir l’analyse", "saved-button saved-button--primary", () => {
        if (!record.inputs || typeof record.inputs !== "object") {
          setStatus("Cette sauvegarde ne contient pas de paramètres exploitables.", true);
          return;
        }
        appInputs.forEach((input) => {
          const value = record.inputs[input.dataset.field];
          if (typeof value === "number" && Number.isFinite(value)) input.value = String(value);
        });
        const scenario = document.getElementById("projectionScenario");
        if (scenario && (record.projectionScenario === "standard" || record.projectionScenario === "colocation")) {
          scenario.value = record.projectionScenario;
        }
        if (appInputs[0]) appInputs[0].dispatchEvent(new Event("input", { bubbles: true }));
        if (scenario) scenario.dispatchEvent(new Event("change", { bubbles: true }));
        setStatus("Analyse ouverte : " + heading.textContent + ". Tu peux la modifier puis l’enregistrer sous un nouveau nom.");
        document.getElementById("synthese").scrollIntoView({ behavior: "smooth", block: "start" });
      }),
      makeButton("Supprimer", "saved-button saved-button--delete", async () => {
        if (!window.confirm("Supprimer « " + heading.textContent + " » de tes biens sauvegardés ?")) return;
        setBusy(true);
        try {
          await deleteDoc(doc(db, "users", currentUser.uid, "properties", snapshot.id));
          setStatus("Analyse supprimée.");
          await loadSaved();
        } catch (error) {
          console.error("Suppression de l’analyse impossible.", error);
          setStatus(explainError(error), true);
        } finally {
          setBusy(false);
        }
      })
    );

    card.append(header, metrics, actions);
    return card;
  }

  async function loadSaved() {
    if (!currentUser) return;
    setBusy(true);
    savedList.replaceChildren();
    emptyState.hidden = false;
    emptyState.textContent = "Chargement de tes analyses…";
    try {
      const records = collection(db, "users", currentUser.uid, "properties");
      const result = await getDocs(query(records, orderBy("updatedAt", "desc")));
      if (result.empty) {
        emptyState.hidden = false;
        emptyState.textContent = "Aucune analyse sauvegardée pour le moment.";
        return;
      }
      emptyState.hidden = true;
      result.forEach((snapshot) => savedList.append(renderSavedItem(snapshot)));
    } catch (error) {
      console.error("Chargement des analyses impossible.", error);
      emptyState.hidden = false;
      emptyState.textContent = "La liste des analyses n’a pas pu être chargée.";
      setStatus(explainError(error), true);
    } finally {
      setBusy(false);
    }
  }

  async function saveCurrentAnalysis(event) {
    event.preventDefault();
    if (!currentUser || busy) return;
    const name = nameInput.value.trim();
    if (!name) {
      nameInput.focus();
      setStatus("Donne un nom à cette analyse avant de l’enregistrer.", true);
      return;
    }

    const analysis = readAnalysis();
    const cashflows = getCashflows(analysis.inputs);
    const scenario = analysis.projectionScenario;
    const payload = {
      name,
      inputs: analysis.inputs,
      projectionScenario: scenario,
      purchasePrice: analysis.inputs.purchasePrice,
      standardCashflow: cashflows.standard,
      colocationCashflow: cashflows.colocation,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    setBusy(true);
    setStatus("Enregistrement de l’analyse dans ton espace Firebase…");
    try {
      await addDoc(collection(db, "users", currentUser.uid, "properties"), payload);
      nameInput.value = "";
      setStatus("Analyse enregistrée dans ton espace Google.");
      await loadSaved();
    } catch (error) {
      console.error("Enregistrement de l’analyse impossible.", error);
      setStatus(explainError(error), true);
    } finally {
      setBusy(false);
    }
  }

  function showSignedOut() {
    currentUser = null;
    accountStatus.textContent = "Non connecté";
    saveForm.hidden = true;
    signInButton.hidden = false;
    signOutButton.hidden = true;
    savedList.replaceChildren();
    emptyState.hidden = false;
    emptyState.textContent = "Connecte-toi avec Google pour enregistrer et retrouver tes analyses sur tes appareils.";
    setStatus("Tes modifications non enregistrées dans le cloud restent sur cet appareil.");
    setBusy(false);
  }

  if (!firebaseReady) {
    accountStatus.textContent = "Connexion Google à configurer";
    signInButton.disabled = true;
    emptyState.textContent = "La configuration du projet Firebase dédié sera ajoutée ici avant la mise en ligne.";
    setStatus("Le site est prêt pour Firebase ; il manque la configuration de l’application Web Firebase.");
    return;
  }

  try {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (error) {
    console.error("Initialisation Firebase impossible.", error);
    accountStatus.textContent = "Connexion indisponible";
    signInButton.disabled = true;
    setStatus("L’application Firebase n’a pas pu démarrer. Vérifie la configuration Web.", true);
    return;
  }

  signInButton.addEventListener("click", async () => {
    if (busy) return;
    setBusy(true);
    setStatus("Ouverture de la connexion Google…");
    try {
      await signInWithRedirect(auth, new GoogleAuthProvider());
    } catch (error) {
      console.error("Connexion Google impossible.", error);
      setStatus(explainError(error), true);
      setBusy(false);
    }
  });

  signOutButton.addEventListener("click", async () => {
    if (busy) return;
    setBusy(true);
    try {
      await signOut(auth);
      setStatus("Déconnecté de Firebase.");
    } catch (error) {
      console.error("Déconnexion impossible.", error);
      setStatus(explainError(error), true);
    } finally {
      setBusy(false);
    }
  });

  saveForm.addEventListener("submit", saveCurrentAnalysis);

  getRedirectResult(auth).catch((error) => {
    console.error("Retour de connexion Google impossible.", error);
    setStatus(explainError(error), true);
  });

  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (!user) {
      showSignedOut();
      return;
    }
    accountStatus.textContent = "Connecté : " + (user.displayName || user.email || "compte Google");
    signInButton.hidden = true;
    signOutButton.hidden = false;
    saveForm.hidden = false;
    setStatus("Tes sauvegardes sont privées et liées à ce compte Google.");
    await loadSaved();
  });
})();

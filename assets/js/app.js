(() => {
  "use strict";

  const STORAGE_KEY = "projet-immo-herblay-v1";
  const DEFAULTS = {
    purchasePrice: 80000,
    agencyFees: 0,
    works: 0,
    dossierFees: 500,
    brokerageFees: 0,
    contribution: 0,
    loanYears: 20,
    interestRate: 3.6,
    surface: 19.48,
    neighborhoodPrice: 5000,
    standardRent: 700,
    standardTenantCharges: 50,
    propertyTaxAnnual: 780,
    coproAnnual: 1045,
    loanInsurance: 30,
    pnoInsurance: 20,
    standardCfeAnnual: 0,
    roomRent: 450,
    roomCount: 2,
    internet: 0,
    electricity: 0,
    water: 0,
    homeInsurance: 0,
    cleaning: 0,
    colocCfeAnnual: 0
  };

  const inputs = [...document.querySelectorAll("[data-field]")];
  const money = new Intl.NumberFormat("fr-FR", {
    style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2
  });
  const percent = new Intl.NumberFormat("fr-FR", {
    style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2
  });
  const plainNumber = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function formatMoney(value) {
    return money.format(Number.isFinite(value) ? value : 0);
  }

  function formatPercent(value) {
    return percent.format(Number.isFinite(value) ? value : 0);
  }

  function readInputs() {
    return Object.fromEntries(inputs.map((input) => {
      const value = input.value.trim() === "" ? 0 : Number(input.value);
      return [input.dataset.field, Number.isFinite(value) ? value : 0];
    }));
  }

  function monthlyPayment(principal, annualRatePercent, years) {
    const months = years * 12;
    if (months <= 0) return 0;
    const monthlyRate = annualRatePercent / 100 / 12;
    if (monthlyRate === 0) return principal / months;
    const factor = 1 - Math.pow(1 + monthlyRate, -months);
    return factor === 0 ? 0 : principal * monthlyRate / factor;
  }

  function calculate(values) {
    const notary = values.purchasePrice < 100000
      ? values.purchasePrice * 0.10
      : values.purchasePrice * 0.08;
    const guaranteeBase = values.purchasePrice + values.agencyFees + notary + values.works + values.dossierFees;
    const bankGuarantee = guaranteeBase * 0.015;
    const operationCost = guaranteeBase + bankGuarantee + values.brokerageFees;
    const loanAmount = operationCost - values.contribution;
    const payment = monthlyPayment(loanAmount, values.interestRate, values.loanYears);
    const propertyTaxMonthly = values.propertyTaxAnnual / 12;
    const coproMonthly = values.coproAnnual / 12;
    const neighborhoodValue = values.surface * values.neighborhoodPrice;
    const purchasePriceM2 = values.surface > 0
      ? (values.purchasePrice + values.agencyFees) / values.surface : 0;
    const operationPriceM2 = values.surface > 0 ? operationCost / values.surface : 0;

    const standardIncome = values.standardRent + values.standardTenantCharges;
    const standardExpenses = payment + propertyTaxMonthly + coproMonthly
      + values.loanInsurance + values.pnoInsurance + values.standardCfeAnnual / 12;
    const standardCashflow = standardIncome - standardExpenses;
    const standardRatio = standardIncome > 0 ? payment / standardIncome : 0;
    const standardYield = operationCost > 0 ? values.standardRent * 12 / operationCost : 0;

    const colocIncome = values.roomRent * values.roomCount;
    const colocExpenses = payment + propertyTaxMonthly + coproMonthly
      + values.loanInsurance + values.pnoInsurance + values.internet
      + values.electricity + values.water + values.homeInsurance + values.cleaning
      + values.colocCfeAnnual / 12;
    const colocCashflow = colocIncome - colocExpenses;
    const colocRatio = colocIncome > 0 ? payment / colocIncome : 0;

    return {
      notary, bankGuarantee, operationCost, loanAmount, payment,
      neighborhoodValue, purchasePriceM2, operationPriceM2,
      propertyTaxMonthly, coproMonthly,
      standardIncome, standardExpenses, standardCashflow, standardRatio, standardYield,
      colocIncome, colocExpenses, colocCashflow, colocRatio
    };
  }

  function rowsMarkup(rows, totalLabel, totalValue) {
    const rowsHtml = rows.map(([label, value]) =>
      '<div class="cost-row"><span>' + label + '</span><strong>' + formatMoney(value) + '</strong></div>'
    ).join("");
    return rowsHtml + '<div class="cost-row cost-row--total"><span>' + totalLabel
      + '</span><strong>' + formatMoney(totalValue) + '</strong></div>';
  }

  function render() {
    const v = readInputs();
    const c = calculate(v);

    setText("summaryOperationCost", formatMoney(c.operationCost));
    setText("summaryLoanAmount", formatMoney(c.loanAmount));
    setText("summaryPayment", formatMoney(c.payment));
    setText("summaryStandardCashflow", formatMoney(c.standardCashflow));
    setText("summaryColocCashflow", formatMoney(c.colocCashflow));

    setText("notaryValue", formatMoney(c.notary));
    setText("guaranteeValue", formatMoney(c.bankGuarantee));
    setText("operationCostValue", formatMoney(c.operationCost));
    setText("loanAmountValue", formatMoney(c.loanAmount));
    setText("paymentValue", formatMoney(c.payment));
    setText("purchasePriceM2", formatMoney(c.purchasePriceM2) + " / m²");
    setText("operationPriceM2", formatMoney(c.operationPriceM2) + " / m²");
    setText("neighborhoodValue", formatMoney(c.neighborhoodValue));

    setText("standardIncome", formatMoney(c.standardIncome));
    setText("standardExpenses", formatMoney(c.standardExpenses));
    setText("standardCashflow", formatMoney(c.standardCashflow));
    setText("standardRatio", formatPercent(c.standardRatio));
    setText("standardYield", formatPercent(c.standardYield));
    document.getElementById("standardIncomeRows").innerHTML = rowsMarkup([
      ["Loyer hors charges", v.standardRent],
      ["Charges locataire", v.standardTenantCharges]
    ], "Recettes mensuelles", c.standardIncome);
    document.getElementById("standardExpenseRows").innerHTML = rowsMarkup([
      ["Crédit immobilier", c.payment],
      ["Taxe foncière (annuelle ÷ 12)", c.propertyTaxMonthly],
      ["Charges de copropriété (annuelles ÷ 12)", c.coproMonthly],
      ["Assurance de prêt", v.loanInsurance],
      ["Assurance PNO", v.pnoInsurance],
      ["CFE (annuelle ÷ 12)", v.standardCfeAnnual / 12]
    ], "Dépenses mensuelles", c.standardExpenses);

    setText("colocIncome", formatMoney(c.colocIncome));
    setText("colocExpenses", formatMoney(c.colocExpenses));
    setText("colocCashflow", formatMoney(c.colocCashflow));
    setText("colocRatio", formatPercent(c.colocRatio));
    // The workbook's colocation yield formula divides by an empty range and returns 0.
    setText("colocYield", formatPercent(0));
    document.getElementById("colocIncomeRows").innerHTML =
      '<div class="cost-row"><span>Loyer par chambre</span><strong>' + formatMoney(v.roomRent) + '</strong></div>' +
      '<div class="cost-row"><span>Nombre de chambres</span><strong>' + plainNumber.format(v.roomCount) + '</strong></div>' +
      '<div class="cost-row cost-row--total"><span>Recettes mensuelles</span><strong>' + formatMoney(c.colocIncome) + '</strong></div>';
    document.getElementById("colocExpenseRows").innerHTML = rowsMarkup([
      ["Crédit immobilier", c.payment],
      ["Taxe foncière (annuelle ÷ 12)", c.propertyTaxMonthly],
      ["Charges de copropriété (annuelles ÷ 12)", c.coproMonthly],
      ["Assurance de prêt", v.loanInsurance],
      ["Assurance PNO", v.pnoInsurance],
      ["Internet", v.internet],
      ["Électricité", v.electricity],
      ["Eau", v.water],
      ["Assurance logement", v.homeInsurance],
      ["Service de ménage", v.cleaning],
      ["CFE (annuelle ÷ 12)", v.colocCfeAnnual / 12]
    ], "Dépenses mensuelles", c.colocExpenses);
  }

  function saveValues() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(readInputs()));
      setText("saveState", "Modifications enregistrées sur cet appareil");
    } catch (_error) {
      setText("saveState", "Modifications actives jusqu’à la fermeture de la page");
    }
  }

  function restoreValues() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!stored || typeof stored !== "object") return false;
      inputs.forEach((input) => {
        const value = stored[input.dataset.field];
        if (Number.isFinite(value)) input.value = String(value);
      });
      return true;
    } catch (_error) {
      return false;
    }
  }

  inputs.forEach((input) => {
    input.addEventListener("input", () => {
      render();
      saveValues();
    });
  });

  const resetButton = document.getElementById("resetButton");
  if (resetButton) {
    resetButton.addEventListener("click", () => {
      inputs.forEach((input) => {
        input.value = String(DEFAULTS[input.dataset.field] ?? 0);
      });
      try { localStorage.removeItem(STORAGE_KEY); } catch (_error) { /* Storage may be unavailable. */ }
      render();
      setText("saveState", "Valeurs du classeur réinitialisées");
    });
  }

  const restored = restoreValues();
  render();
  setText("saveState", restored ? "Valeurs sauvegardées sur cet appareil" : "Valeurs de départ du classeur");
})();

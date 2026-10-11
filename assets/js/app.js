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
    colocCfeAnnual: 0,
    annualAppreciationRate: 0.5,
    taxMarginalRate: "",
    socialContributionRate: 18.6,
    annualAdditionalDeductions: 0,
    annualTaxAmortization: 0
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

  function visibleSpaces(value) {
    return value.replace(/[\u202f\u00a0]/g, " ");
  }

  function formatMoney(value) {
    return visibleSpaces(money.format(Number.isFinite(value) ? value : 0));
  }

  function formatPercent(value) {
    return visibleSpaces(percent.format(Number.isFinite(value) ? value : 0));
  }

  function formatPlainNumber(value) {
    return visibleSpaces(plainNumber.format(Number.isFinite(value) ? value : 0));
  }

  function normalizeNumericText(rawValue) {
    const compact = String(rawValue).trim().replace(/[\s\u00a0\u202f\u2009]/g, "");
    const comma = compact.lastIndexOf(",");
    const dot = compact.lastIndexOf(".");
    if (comma >= 0 && dot >= 0) {
      return comma > dot
        ? compact.replace(/\./g, "").replace(/,/g, ".")
        : compact.replace(/,/g, "");
    }
    return compact.replace(/,/g, ".");
  }

  function parseNumericInput(rawValue) {
    if (String(rawValue).trim() === "") return null;
    const value = Number(normalizeNumericText(rawValue));
    return Number.isFinite(value) ? value : null;
  }

  function groupedInputValue(value) {
    const parts = String(value).split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return parts.join(".");
  }

  function formatNumericInput(input) {
    const value = parseNumericInput(input.value);
    if (value !== null) input.value = groupedInputValue(value);
  }

  function prepareNumericInput(input) {
    const before = input.value;
    const cursor = input.selectionStart;
    const normalized = normalizeNumericText(before);
    input.value = normalized;
    if (cursor !== null) {
      const prefix = normalizeNumericText(before.slice(0, cursor));
      const position = Math.min(prefix.length, normalized.length);
      input.setSelectionRange(position, position);
    }
  }

  function normalizeTypedNumber(input) {
    const before = input.value;
    const cursor = input.selectionStart;
    const normalized = normalizeNumericText(before);
    if (normalized === before) return;
    input.value = normalized;
    if (cursor !== null) {
      const prefix = normalizeNumericText(before.slice(0, cursor));
      const position = Math.min(prefix.length, normalized.length);
      input.setSelectionRange(position, position);
    }
  }

  function readInputs() {
    return Object.fromEntries(inputs.map((input) => {
      const rawValue = input.value.trim();
      if (input.dataset.field === "taxMarginalRate" && rawValue === "") {
        return [input.dataset.field, null];
      }
      const parsed = parseNumericInput(rawValue);
      return [input.dataset.field, parsed === null ? 0 : parsed];
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
    const loanAmount = Math.max(0, operationCost - values.contribution);
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

  function buildLoanSchedule(values, calculations) {
    const monthsTotal = Math.max(1, Math.round(values.loanYears * 12));
    const yearsTotal = Math.ceil(monthsTotal / 12);
    const monthlyRate = Math.max(0, values.interestRate) / 100 / 12;
    let balance = Math.max(0, calculations.loanAmount);
    const schedule = [{
      year: 0,
      balance,
      principalRepaid: 0,
      interestPaid: 0,
      payments: 0
    }];

    for (let year = 1; year <= yearsTotal; year += 1) {
      let principalRepaid = 0;
      let interestPaid = 0;
      let payments = 0;
      const monthsThisYear = Math.min(12, monthsTotal - (year - 1) * 12);

      for (let month = 0; month < monthsThisYear && balance > 0; month += 1) {
        const interest = balance * monthlyRate;
        const payment = Math.min(Math.max(0, calculations.payment), balance + interest);
        const principal = Math.min(balance, Math.max(0, payment - interest));
        balance = Math.max(0, balance - principal);
        principalRepaid += principal;
        interestPaid += interest;
        payments += payment;
      }

      schedule.push({ year, balance, principalRepaid, interestPaid, payments });
    }
    return schedule;
  }

  function annualDeductibleExpenses(values, useColocation) {
    const amount = (value) => Math.max(0, Number(value) || 0);
    let total = amount(values.propertyTaxAnnual) + amount(values.coproAnnual)
      + 12 * (amount(values.loanInsurance) + amount(values.pnoInsurance));

    if (useColocation) {
      total += 12 * (amount(values.internet) + amount(values.electricity)
        + amount(values.water) + amount(values.homeInsurance) + amount(values.cleaning));
      total += amount(values.colocCfeAnnual);
    } else {
      total += amount(values.standardCfeAnnual);
    }
    return total;
  }

  function renderProjection(values, calculations) {
    const tableBody = document.getElementById("projectionTableBody");
    const chart = document.getElementById("wealthChart");
    if (!tableBody || !chart) return;

    const annualRate = Math.max(-100, Math.min(100, values.annualAppreciationRate)) / 100;
    const scenarioControl = document.getElementById("projectionScenario");
    const useColocation = scenarioControl && scenarioControl.value === "colocation";
    const monthlyCashflow = useColocation ? calculations.colocCashflow : calculations.standardCashflow;
    const scenarioLabel = useColocation ? "colocation" : "location standard";
    const annualRent = 12 * (useColocation ? calculations.colocIncome : calculations.standardIncome);
    const extraDeductions = Math.max(0, Number(values.annualAdditionalDeductions) || 0);
    const requestedAmortization = Math.max(0, Number(values.annualTaxAmortization) || 0);
    const marginalRate = Number.isFinite(values.taxMarginalRate)
      ? Math.max(0, Math.min(45, values.taxMarginalRate)) / 100
      : null;
    const socialRate = Math.max(0, Math.min(50, Number(values.socialContributionRate) || 0)) / 100;
    const schedule = buildLoanSchedule(values, calculations);
    const years = schedule.length - 1;
    let cumulativeCashflow = 0;

    const rows = schedule.map((loanRow, year) => {
      const propertyValue = calculations.neighborhoodValue * Math.pow(1 + annualRate, year);
      const propertyEquity = propertyValue - loanRow.balance;
      const grossRent = year === 0 ? 0 : annualRent;
      const ordinaryDeductions = year === 0 ? 0 : annualDeductibleExpenses(values, useColocation);
      const otherPaidDeductions = year === 0 ? 0 : extraDeductions;
      const resultBeforeAmortization = grossRent - ordinaryDeductions
        - loanRow.interestPaid - otherPaidDeductions;
      const amortizationUsed = Math.min(
        Math.max(0, resultBeforeAmortization),
        year === 0 ? 0 : requestedAmortization
      );
      const taxableResult = resultBeforeAmortization - amortizationUsed;
      const taxableBase = Math.max(0, taxableResult);
      const incomeTax = marginalRate === null ? 0 : taxableBase * marginalRate;
      const socialContributions = taxableBase * socialRate;
      const totalTax = incomeTax + socialContributions;
      const deductions = ordinaryDeductions + loanRow.interestPaid
        + otherPaidDeductions + amortizationUsed;
      const annualCashflowAfterTax = year === 0
        ? 0
        : monthlyCashflow * 12 - otherPaidDeductions - totalTax;

      cumulativeCashflow += annualCashflowAfterTax;
      const projectResult = propertyEquity + cumulativeCashflow - values.contribution;
      return {
        year,
        propertyValue,
        loanBalance: loanRow.balance,
        principalRepaid: loanRow.principalRepaid,
        interestPaid: loanRow.interestPaid,
        loanPayments: loanRow.payments,
        grossRent,
        deductions,
        taxableResult,
        incomeTax,
        socialContributions,
        totalTax,
        afterTaxMonthlyCashflow: annualCashflowAfterTax / 12,
        cumulativeCashflow,
        propertyEquity,
        projectResult
      };
    });

    const finalRow = rows[rows.length - 1];
    const firstOperatingYear = rows[1] || rows[0];
    setText("projectionBaseValue", formatMoney(calculations.neighborhoodValue));
    setText("projectionScenarioName", scenarioLabel);
    setText("projectionEndValue", formatMoney(finalRow.propertyValue));
    setText("projectionEndDebt", formatMoney(finalRow.loanBalance));
    setText("projectionEndEquity", formatMoney(finalRow.propertyEquity));
    setText("projectionEndResult", formatMoney(finalRow.projectResult));
    setText("taxGrossRentYear1", formatMoney(firstOperatingYear.grossRent));
    setText("taxDeductionsYear1", formatMoney(firstOperatingYear.deductions));
    setText("taxableBicYear1", formatMoney(firstOperatingYear.taxableResult));
    setText("taxIncomeYear1", formatMoney(firstOperatingYear.incomeTax));
    setText("taxSocialYear1", formatMoney(firstOperatingYear.socialContributions));
    setText("taxNetMonthlyYear1", formatMoney(firstOperatingYear.afterTaxMonthlyCashflow));
    const tmiInput = document.getElementById("taxMarginalRate");
    setText("taxEstimateNotice", !tmiInput || tmiInput.value.trim() === ""
      ? "Saisis ton taux marginal d’imposition pour estimer l’impôt sur le revenu ; les prélèvements sociaux affichés restent une estimation."
      : "Estimation simplifiée : vérifie le taux et les charges admises avec ton comptable.");

    tableBody.innerHTML = rows.map((row) =>
      '<tr><th scope="row">' + row.year + '</th>' +
      '<td>' + formatMoney(row.grossRent) + '</td>' +
      '<td>' + formatMoney(row.principalRepaid) + '</td>' +
      '<td>' + formatMoney(row.interestPaid) + '</td>' +
      '<td>' + formatMoney(row.loanBalance) + '</td>' +
      '<td>' + formatMoney(Math.max(0, row.deductions - row.interestPaid)) + '</td>' +
      '<td>' + formatMoney(row.taxableResult) + '</td>' +
      '<td>' + formatMoney(row.totalTax) + '</td>' +
      '<td>' + formatMoney(row.afterTaxMonthlyCashflow) + '</td>' +
      '<td>' + formatMoney(row.propertyValue) + '</td>' +
      '<td>' + formatMoney(row.propertyEquity) + '</td>' +
      '<td>' + formatMoney(row.cumulativeCashflow) + '</td>' +
      '<td class="projection-table__gain">' + formatMoney(row.projectResult) + '</td></tr>'
    ).join("");

    const width = 960;
    const height = 340;
    const left = 76;
    const right = 24;
    const top = 20;
    const bottom = 48;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const maxValue = Math.max(1, ...rows.map((row) => Math.max(row.propertyValue, row.loanBalance))) * 1.06;
    const x = (index) => left + (rows.length === 1 ? plotWidth / 2 : (index / (rows.length - 1)) * plotWidth);
    const y = (value) => top + plotHeight * (1 - Math.max(0, value) / maxValue);
    const valuePath = rows.map((row, index) => (index === 0 ? "M" : "L") + x(index).toFixed(1) + " " + y(row.propertyValue).toFixed(1)).join(" ");
    const debtPath = rows.map((row, index) => (index === 0 ? "M" : "L") + x(index).toFixed(1) + " " + y(row.loanBalance).toFixed(1)).join(" ");
    const labelStep = Math.max(1, Math.ceil(years / 6));
    const grid = Array.from({ length: 5 }, (_, index) => {
      const fraction = index / 4;
      const gridY = top + plotHeight * fraction;
      const label = formatPlainNumber((maxValue * (1 - fraction)) / 1000) + " k€";
      return '<line class="projection-chart__grid" x1="' + left + '" y1="' + gridY.toFixed(1) + '" x2="' + (width - right) + '" y2="' + gridY.toFixed(1) + '" />' +
        '<text class="projection-chart__axis" x="' + (left - 10) + '" y="' + (gridY + 4).toFixed(1) + '" text-anchor="end">' + label + '</text>';
    }).join("");
    const yearLabels = rows.filter((row) => row.year % labelStep === 0 || row.year === years).map((row) =>
      '<text class="projection-chart__axis" x="' + x(row.year).toFixed(1) + '" y="' + (height - 16) + '" text-anchor="middle">' + row.year + '</text>'
    ).join("");
    const valueDots = rows.map((row, index) => '<circle class="projection-chart__dot projection-chart__dot--value" cx="' + x(index).toFixed(1) + '" cy="' + y(row.propertyValue).toFixed(1) + '" r="3" />').join("");
    const debtDots = rows.map((row, index) => '<circle class="projection-chart__dot projection-chart__dot--debt" cx="' + x(index).toFixed(1) + '" cy="' + y(row.loanBalance).toFixed(1) + '" r="3" />').join("");

    chart.innerHTML = '<svg class="projection-chart" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-labelledby="projectionChartTitle projectionChartDescription">' +
      '<title id="projectionChartTitle">Projection annuelle du bien et du prêt</title>' +
      '<desc id="projectionChartDescription">La valeur estimée du logement et le capital restant dû sont comparés année par année jusqu’à la fin du prêt.</desc>' +
      grid +
      '<path class="projection-chart__line projection-chart__line--value" d="' + valuePath + '" />' +
      '<path class="projection-chart__line projection-chart__line--debt" d="' + debtPath + '" />' +
      valueDots + debtDots + yearLabels +
      '<text class="projection-chart__axis-title" x="' + (width / 2) + '" y="' + (height - 2) + '" text-anchor="middle">Année</text>' +
      '</svg>';
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
    renderProjection(v, c);
  }

  function saveValues() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(readInputs()));
      const savedScenarioControl = document.getElementById("projectionScenario");
      if (savedScenarioControl) localStorage.setItem(STORAGE_KEY + "-projection", savedScenarioControl.value);
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
      const savedScenarioControl = document.getElementById("projectionScenario");
      const savedScenario = localStorage.getItem(STORAGE_KEY + "-projection");
      if (savedScenarioControl && (savedScenario === "standard" || savedScenario === "colocation")) {
        savedScenarioControl.value = savedScenario;
      }
      return true;
    } catch (_error) {
      return false;
    }
  }

  inputs.forEach((input) => {
    input.addEventListener("focus", () => prepareNumericInput(input));
    input.addEventListener("input", () => {
      normalizeTypedNumber(input);
      render();
      saveValues();
    });
    input.addEventListener("blur", () => {
      formatNumericInput(input);
      saveValues();
    });
  });

  const projectionScenarioControl = document.getElementById("projectionScenario");
  if (projectionScenarioControl) {
    projectionScenarioControl.addEventListener("change", () => {
      render();
      saveValues();
    });
  }

  const resetButton = document.getElementById("resetButton");
  if (resetButton) {
    resetButton.addEventListener("click", () => {
      inputs.forEach((input) => {
        input.value = String(DEFAULTS[input.dataset.field] ?? 0);
        formatNumericInput(input);
      });
      try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(STORAGE_KEY + "-projection");
      } catch (_error) { /* Storage may be unavailable. */ }
      if (projectionScenarioControl) projectionScenarioControl.value = "standard";
      render();
      setText("saveState", "Valeurs du classeur réinitialisées");
    });
  }

  const restored = restoreValues();
  inputs.forEach(formatNumericInput);
  render();
  setText("saveState", restored ? "Valeurs sauvegardées sur cet appareil" : "Valeurs de départ du classeur");
})();

const cashflowForm = document.getElementById("cashflow-form");
const cashflowSummaryRoot = document.getElementById("cashflowSummary");
const cashflowBreakdownRoot = document.getElementById("cashflowBreakdown");
const cashflowChartContext = document.getElementById("cashflowChart");
const cashflowCopy = document.getElementById("cashflowCopy");

let cashflowChart;

const cashCurrency = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: window.OrionCurrency?.code() || "GBP",
  maximumFractionDigits: 0
});

const getCashNumber = (id) => Number(document.getElementById(id).value);

const buildCashflowData = () => {
  const openingCash = Math.max(0, getCashNumber("openingCash"));
  const upfrontSpend = Math.max(0, getCashNumber("upfrontSpend"));
  const monthlyUnits = Math.max(0, getCashNumber("monthlyUnits"));
  const monthlyGrowth = Math.max(0, getCashNumber("monthlyGrowth")) / 100;
  const sellingPrice = Math.max(0, getCashNumber("sellingPriceCash"));
  const cogsPerUnit = Math.max(0, getCashNumber("cogsPerUnit"));
  const monthlyOverhead = Math.max(0, getCashNumber("monthlyOverhead"));
  const paymentDelay = Math.max(0, getCashNumber("paymentDelay"));

  const months = Array.from({ length: 12 }, (_, index) => `M${index + 1}`);
  const unitsByMonth = months.map((_, index) => Math.round(monthlyUnits * Math.pow(1 + monthlyGrowth, index)));
  const revenueByMonth = unitsByMonth.map((units) => units * sellingPrice);
  const cashInByMonth = months.map((_, index) => (index - paymentDelay >= 0 ? revenueByMonth[index - paymentDelay] : 0));
  const cashOutByMonth = unitsByMonth.map((units, index) => units * cogsPerUnit + monthlyOverhead + (index === 0 ? upfrontSpend : 0));

  let runningCash = openingCash;
  const closingCashByMonth = months.map((_, index) => {
    runningCash += cashInByMonth[index] - cashOutByMonth[index];
    return runningCash;
  });

  return {
    openingCash,
    upfrontSpend,
    monthlyOverhead,
    paymentDelay,
    months,
    unitsByMonth,
    cashInByMonth,
    cashOutByMonth,
    closingCashByMonth
  };
};

function renderCashflowSensitivity() {
  const delay = Math.max(0, Number(document.getElementById("paymentDelay")?.value) || 0);
  window.OrionSensitivity?.render({
    after: cashflowBreakdownRoot,
    title: "Which input matters most for the cash low point?",
    better: "higher",
    format: (v) => cashCurrency.format(v),
    inputs: [
      { id: "openingCash", label: "Opening cash" },
      { id: "upfrontSpend", label: "Upfront spend" },
      { id: "monthlyUnits", label: "Starting monthly units" },
      { id: "monthlyGrowth", label: "Monthly growth" },
      { id: "sellingPriceCash", label: "Selling price" },
      { id: "cogsPerUnit", label: "COGS per unit" },
      { id: "monthlyOverhead", label: "Monthly overhead" }
    ],
    note: "Payment delay is held at its current value.",
    compute: (v) => {
      let cash = v.openingCash;
      let lowest = Infinity;
      const units = Array.from({ length: 12 }, (_, i) => Math.round(v.monthlyUnits * Math.pow(1 + v.monthlyGrowth / 100, i)));
      units.forEach((u, i) => {
        const cashIn = i - delay >= 0 ? units[i - delay] * v.sellingPriceCash : 0;
        cash += cashIn - (u * v.cogsPerUnit + v.monthlyOverhead + (i === 0 ? v.upfrontSpend : 0));
        lowest = Math.min(lowest, cash);
      });
      return lowest;
    }
  });
}

const updateCashflowTool = () => {
  renderCashflowSensitivity();
  const data = buildCashflowData();
  const lowestCash = Math.min(...data.closingCashByMonth);
  const endCash = data.closingCashByMonth[data.closingCashByMonth.length - 1];
  const firstNegativeMonth = data.closingCashByMonth.findIndex((value) => value < 0);
  const totalUnits = data.unitsByMonth.reduce((sum, value) => sum + value, 0);

  cashflowSummaryRoot.innerHTML = `
    <div class="result-card">
      <strong>${cashCurrency.format(lowestCash)}</strong>
      <span>Lowest projected cash position</span>
    </div>
    <div class="result-card">
      <strong>${cashCurrency.format(endCash)}</strong>
      <span>Closing cash after 12 months</span>
    </div>
    <div class="result-card">
      <strong>${firstNegativeMonth === -1 ? "12+ months" : `Month ${firstNegativeMonth + 1}`}</strong>
      <span>Runway before cash turns negative</span>
    </div>
  `;

  cashflowBreakdownRoot.innerHTML = `
    <div class="comparison-item">
      <span>Total projected units</span>
      <strong>${totalUnits.toLocaleString()}</strong>
    </div>
    <div class="comparison-item">
      <span>Payment delay</span>
      <strong>${data.paymentDelay} month${data.paymentDelay === 1 ? "" : "s"}</strong>
    </div>
    <div class="comparison-item">
      <span>Month 1 upfront spend</span>
      <strong>${cashCurrency.format(data.upfrontSpend)}</strong>
    </div>
    <div class="comparison-item">
      <span>Monthly fixed overhead</span>
      <strong>${cashCurrency.format(data.monthlyOverhead)}</strong>
    </div>
  `;

  if (cashflowChart) {
    cashflowChart.destroy();
  }

  cashflowChart = new Chart(cashflowChartContext, {
    type: "line",
    data: {
      labels: data.months,
      datasets: [
        {
          label: "Closing cash",
          data: data.closingCashByMonth,
          borderColor: OrionColours.get("space-blue"),
          backgroundColor: OrionColours.rgba("space-blue", 0.08),
          borderWidth: 2,
          tension: 0.24
        },
        {
          label: "Cash in",
          data: data.cashInByMonth,
          borderColor: OrionColours.get("teal"),
          backgroundColor: OrionColours.rgba("teal", 0.08),
          borderWidth: 2,
          tension: 0.24
        },
        {
          label: "Cash out",
          data: data.cashOutByMonth,
          borderColor: OrionColours.get("magenta"),
          backgroundColor: OrionColours.rgba("magenta", 0.08),
          borderWidth: 2,
          tension: 0.24
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom"
        },
        tooltip: {
          callbacks: {
            label(context) {
              return `${context.dataset.label}: ${cashCurrency.format(context.parsed.y)}`;
            }
          }
        }
      },
      scales: {
        y: {
          ticks: {
            callback(value) {
              return cashCurrency.format(value);
            }
          }
        }
      }
    }
  });

  if (cashflowCopy) {
    cashflowCopy.value =
      `Cashflow Projection\n` +
      `Lowest projected cash: ${cashCurrency.format(lowestCash)}\n` +
      `Closing cash after 12 months: ${cashCurrency.format(endCash)}\n` +
      `Runway before negative cash: ${firstNegativeMonth === -1 ? "12+ months" : `Month ${firstNegativeMonth + 1}`}\n` +
      `Total projected units: ${totalUnits.toLocaleString()}\n` +
      `Payment delay: ${data.paymentDelay} month${data.paymentDelay === 1 ? "" : "s"}`;
  }

  // Plain-English interpretation (shared panel in main.js).
  const money = (value) => cashCurrency.format(value);
  const closing = data.closingCashByMonth;
  const lowestMonth = closing.indexOf(lowestCash) + 1;
  const overhead = data.monthlyOverhead;
  const bufferMonths = overhead > 0 ? lowestCash / overhead : lowestCash > 0 ? Infinity : 0;
  const finalMove = closing[closing.length - 1] - closing[closing.length - 2];
  const stillFalling = finalMove < 0;
  const monthsBeyondYear = stillFalling && endCash > 0 ? endCash / -finalMove : Infinity;
  const delayNote = data.paymentDelay > 0 && totalUnits > 0
    ? `Customers pay ${data.paymentDelay} month${data.paymentDelay === 1 ? "" : "s"} after the sale, so stock and overhead go out well before cash comes in; deposits or shorter terms would lift the low point.`
    : "";

  if (firstNegativeMonth !== -1) {
    window.OrionInsight?.show({
      level: "worrying",
      headline: `${firstNegativeMonth === 0 ? "Cash is short from month 1" : `Cash runs out in month ${firstNegativeMonth + 1}`} and reaches ${money(lowestCash)} at its lowest (month ${lowestMonth}), so you would need at least ${money(-lowestCash)} more, plus a buffer, before then.`,
      points: [
        delayNote || "Cash out exceeds cash in for too long: look at staging stock purchases, the month 1 upfront spend and monthly overhead before assuming faster growth will fix it.",
        `Many founders aim to raise with roughly twelve to eighteen months of runway, and fundraising itself usually takes several months, so plan for funding to land ${firstNegativeMonth === 0 ? "before launch" : `well before month ${firstNegativeMonth + 1}`}.`,
        "Also try a lower growth rate: when stock is paid for before customers pay, faster growth often deepens the dip rather than closing it."
      ],
      next: { href: "startup-cost-planner.html", label: "Check what the upfront spend is made of in the Startup Cost Planner" }
    });
  } else if (bufferMonths < 3 || monthsBeyondYear < 6) {
    const headline = bufferMonths < 3
      ? overhead > 0
        ? `Cash stays positive all year, but the low point of ${money(lowestCash)} in month ${lowestMonth} is only about ${bufferMonths.toFixed(1)} months of fixed overhead, so one late payment or slow month could cause a shortfall.`
        : `Cash never goes negative, but it sits at ${money(lowestCash)} in month ${lowestMonth}, leaving no buffer for a late payment or a slow month.`
      : `Cash stays positive all year with a low of ${money(lowestCash)}, but it is still falling by about ${money(-finalMove)} a month at month 12, which leaves only around ${Math.max(0, Math.floor(monthsBeyondYear))} months into year two.`;
    window.OrionInsight?.show({
      level: "borderline",
      headline,
      points: [
        "A buffer of roughly three to six months of fixed overhead is a common minimum for absorbing a delayed payment, a larger stock order or a slipped launch.",
        delayNote || (stillFalling ? "Cash is still heading down at the end of the year, so check when the monthly cash flow turns positive before committing to more stock or overhead." : ""),
        "Test a longer payment delay and slower growth to see how much headroom you really have."
      ],
      next: { href: "investor-metrics-kpis.html", label: "Check runway and margin in Investor Metrics and KPIs" }
    });
  } else {
    window.OrionInsight?.show({
      level: "good",
      headline: overhead > 0
        ? `Cash stays positive all year: the lowest point is ${money(lowestCash)} in month ${lowestMonth}, about ${bufferMonths.toFixed(1)} months of fixed overhead, and you close the year on ${money(endCash)}.`
        : `Cash stays positive all year, with a lowest point of ${money(lowestCash)} in month ${lowestMonth} and ${money(endCash)} at the end of the year.`,
      points: [
        stillFalling
          ? `Cash is still falling by about ${money(-finalMove)} a month at month 12, so check when it turns upwards in year two.`
          : "The curve is flat or rising by the end of the year, which suggests the plan can absorb a late payment or a slower month.",
        "This relies on the volume, growth and payment terms happening as entered; test slower growth and a longer payment delay before relying on it."
      ],
      next: { href: "investor-metrics-kpis.html", label: "See how the plan reads to investors in Investor Metrics and KPIs" }
    });
  }
};

cashflowForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updateCashflowTool();

  if (window.OrionAnalytics) {
    window.OrionAnalytics.trackEvent("calculate", {
      tool_name: "cashflow_projection",
      opening_cash: Math.max(0, getCashNumber("openingCash")),
      monthly_units: Math.max(0, getCashNumber("monthlyUnits"))
    });
  }
});
cashflowForm.querySelectorAll("input, select, textarea").forEach((field) => {
  field.addEventListener("input", updateCashflowTool);
  field.addEventListener("change", updateCashflowTool);
});
if (window.OrionAnalytics) {
  window.OrionAnalytics.trackEvent("tool_used", {
    tool_name: "cashflow_projection"
  });
}

updateCashflowTool();

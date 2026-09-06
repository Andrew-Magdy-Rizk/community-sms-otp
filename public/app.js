const form = document.querySelector("#otp-form");
const phoneInput = document.querySelector("#phone");
const button = document.querySelector("#submit-button");
const buttonText = button.querySelector(".button-text");
const result = document.querySelector("#result");
const quotaValue = document.querySelector("#quota-value");
const refreshQuotaButton = document.querySelector("#refresh-quota");
let quotaRequestInFlight = false;

function showQuota(data) {
  quotaValue.classList.remove("error");

  if (!data.ok) {
    quotaValue.classList.add("error");
    quotaValue.textContent = data.message || "تعذر قراءة الرصيد.";
    return;
  }

  quotaValue.textContent = data.unlimited
    ? "غير محدود"
    : `${new Intl.NumberFormat("ar-EG").format(data.remaining)} رسالة`;
}

async function refreshQuota() {
  if (quotaRequestInFlight) return;

  quotaRequestInFlight = true;
  refreshQuotaButton.disabled = true;
  quotaValue.classList.remove("error");
  quotaValue.textContent = "جارٍ التحديث…";

  try {
    const response = await fetch("/api/quota", { cache: "no-store" });
    const data = await response.json();
    showQuota(data);
  } catch {
    quotaValue.classList.add("error");
    quotaValue.textContent = "تعذر قراءة الرصيد. حاول مرة أخرى.";
  } finally {
    quotaRequestInFlight = false;
    refreshQuotaButton.disabled = false;
  }
}

function showResult(kind, message, smsId) {
  result.hidden = false;
  result.className = `result ${kind}`;
  result.replaceChildren(document.createTextNode(message));

  if (smsId) {
    const reference = document.createElement("small");
    reference.textContent = `SMS ID: ${smsId}`;
    result.append(reference);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  result.hidden = true;
  button.disabled = true;
  button.classList.add("loading");
  buttonText.textContent = "جاري الإرسال...";

  try {
    const response = await fetch("/api/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: phoneInput.value }),
    });
    const data = await response.json();
    showResult(data.ok ? "success" : "error", data.message, data.smsId);
    refreshQuota();
  } catch {
    showResult(
      "error",
      "تعذر الاتصال بالـ server. تأكد أنه يعمل ثم حاول مرة أخرى.",
    );
  } finally {
    button.disabled = false;
    button.classList.remove("loading");
    buttonText.textContent = "إرسال OTP";
  }
});

refreshQuotaButton.addEventListener("click", refreshQuota);
refreshQuota();
window.setInterval(refreshQuota, 60_000);

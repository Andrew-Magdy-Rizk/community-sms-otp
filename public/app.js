const form = document.querySelector("#otp-form");
const phoneInput = document.querySelector("#phone");
const button = document.querySelector("#submit-button");
const buttonText = button.querySelector(".button-text");
const result = document.querySelector("#result");

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

# Community SMS OTP Tester

مشروع تجريبي بسيط بـ Node.js وTypeScript وواجهة HTML لإرسال OTP عبر Community SMS API.

## التشغيل

1. ثبّت Node.js 20 أو أحدث.
2. افتح Terminal داخل مجلد المشروع وشغّل:

```bash
npm install
cp .env.example .env
```

3. عدّل `.env` وضع بيانات الحساب واسم الـ Sender المعتمد:

```env
COMMUNITY_SMS_USERNAME=your_username
COMMUNITY_SMS_PASSWORD=your_password
COMMUNITY_SMS_SENDER=your_approved_sender
PORT=3000
```

4. شغّل المشروع:

```bash
npm run dev
```

5. افتح `http://localhost:3000` وأدخل رقم موبايل مصري.

## اختبار وفحص الكود

```bash
npm test
npm run build
```

## ملاحظات مهمة

- الـ API المستخدم: `POST /SendSMSAPI/api/SMSSender/SendSMS`.
- نتيجة `0` تعني أن مزود الخدمة قبل طلب الإرسال، وليست تأكيدًا لوصول الرسالة إلى الهاتف. إذا لم تصل، راجع حالة `SMS ID` مع Community.
- لو ظهرت النتيجة `-2`، أضف الـ public IP الخاص بالجهاز أو الـ server إلى IP whitelist لدى Community.
- اسم الـ Sender لازم يكون مسجلًا ومعتمدًا في الحساب؛ وإلا قد يرجع الكود `-30`.
- هذا الاختبار يرسل OTP فقط ولا يخزنه أو يتحقق منه.
- لا ترفع ملف `.env` إلى Git أو تشاركه مع أي شخص.

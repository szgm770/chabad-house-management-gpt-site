# מערכת ניהול בית חב״ד GPT

מערכת RTL לניהול תורמים, תנועות, שימור קשר, סקירות פעילות ותזרים בנקאי.

## פריסה ב־Vercel

הפרויקט הוא יישום Next.js מלא. לאחר חיבור המאגר ל־Vercel, יש להגדיר את משתני הסביבה הבאים בכל סביבות Production ו־Preview:

- `APP_URL` — כתובת ה־Vercel הקבועה, ללא לוכסן בסוף.
- `AUTH_SECRET` — מפתח אקראי ארוך לחתימת התחברות.
- `ALLOWED_EMAILS` — כתובות Google מורשות, מופרדות בפסיקים.
- `GOOGLE_CLIENT_ID` ו־`GOOGLE_CLIENT_SECRET` — פרטי OAuth מ־Google Cloud.
- `CLOUDFLARE_ACCOUNT_ID` — מזהה חשבון Cloudflare שמחזיק את D1.
- `CLOUDFLARE_D1_DATABASE_ID` — מזהה מסד D1 של האתר. אפשר לחלופין להשתמש ב־`CLOUDFLARE_D1_DATABASE_NAME` עם שם המסד, למשל `chabad-bs-production`.
- `CLOUDFLARE_D1_API_TOKEN` — אסימון שרת עם הרשאת D1 Edit למסד בלבד.

ב־Google Cloud יש להוסיף Authorized redirect URI:

`https://YOUR-PROJECT.vercel.app/api/auth/google/callback`

אין לשמור סודות בקוד או ב־GitHub. הקובץ `.env.example` מכיל שמות בלבד.

## מסד הנתונים

הפריסה ב־Vercel משתמשת במסד D1 בחשבון Cloudflare שבבעלות מנהל המערכת, דרך API מאובטח מצד השרת. משאבי D1 שמנוהלים פנימית על ידי Sites אינם נחשפים ישירות ל־Vercel, ולכן בפריסה הראשונה יש ליצור D1 בבעלותכם ולהעביר אליו את הסכמה והנתונים באמצעות כלי הגיבוי/ייבוא של המערכת. אסימון Cloudflare לעולם אינו נשלח לדפדפן.

## פקודות

- `npm run dev` — סביבת פיתוח Next.js.
- `npm run build` — בניית Production זהה לבנייה של Vercel.
- `npm start` — הרצת הבנייה המקומית.

## אבטחה

- כל המסכים ונתיבי ה־API הפנימיים מוגנים באמצעות Session חתום ו־HTTP-only cookie.
- רק כתובות שנמצאות ב־`ALLOWED_EMAILS` מורשות להיכנס.
- כניסה מתבצעת באמצעות Google OAuth.
- סודות ומפתחות נשמרים רק ב־Vercel Environment Variables.

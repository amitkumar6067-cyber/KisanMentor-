/**
 * KisanMentor — Central configuration
 *
 * BEFORE FIRST DEPLOY: set siteUrl and basePath to match your GitHub Pages URL.
 *
 * GitHub project site example:
    siteUrl: "https://amitkumar6067-cyber.github.io/KisanMentor-",
    basePath: "/KisanMentor-",
 *
 * User site or custom domain at root:
 *   siteUrl:  "https://YOUR_GITHUB_USERNAME.github.io"
 *   basePath: ""
 *   // or siteUrl: "https://www.yourdomain.com", basePath: ""
 */
module.exports = {
  siteName: "KisanMentor",
  siteNameHi: "किसान मेंटर",
  tagline: "खेती की सही जानकारी, बेहतर भविष्य",
  description:
    "किसानों और कृषि छात्रों के लिए फसल गाइड, मिट्टी, कीट-रोग, सरकारी योजनाएँ और परीक्षा नोट्स — आसान हिंदी में।",
  language: "hi",
  locale: "hi_IN",

  // REQUIRED: replace with your real public site URL (no trailing slash)
  siteUrl: "https://amitkumar6067-cyber.github.io/KisanMentor-",
basePath: "/KisanMentor-",
  defaultAuthor: "KisanMentor Editorial",

  // Optional public contact email shown on contact page. Leave "" if none yet.
  contactEmail: "",

  // Optional default social image path (must exist under assets if set). Leave "" if none.
  defaultOgImage: "",

  adsEnabled: false,

  categories: [
    { slug: "fasal-utpadan", name: "फसल उत्पादन", description: "धान, गेहूं और अन्य फसलों की खेती संबंधी जानकारी" },
    { slug: "mitti-poshan", name: "मिट्टी और पोषण", description: "मिट्टी स्वास्थ्य, खाद और उर्वरक प्रबंधन" },
    { slug: "rog-keet", name: "रोग और कीट", description: "फसल के रोग, कीट पहचान और नियंत्रण" },
    { slug: "sarkari-yojana", name: "सरकारी योजनाएँ", description: "कृषि संबंधी सरकारी योजनाओं की स्पष्ट जानकारी" },
    { slug: "agriculture-students", name: "कृषि छात्र", description: "नोट्स, प्रश्नोत्तर और परीक्षा सामग्री" },
    { slug: "farming-technology", name: "खेती की तकनीक", description: "सिंचाई, मशीनरी और आधुनिक विधियाँ" },
  ],

  types: [
    "article", "crop-guide", "farming-guide", "soil-guide", "fertilizer-guide",
    "pest-disease", "agriculture-news", "government-scheme", "agriculture-notes",
    "student-qa", "mcq", "pyq", "comparison", "research-guide", "step-by-step", "case-study",
  ],

  statuses: ["draft", "published", "archived"],
};

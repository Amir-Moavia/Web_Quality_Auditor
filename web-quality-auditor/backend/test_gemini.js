import { GoogleGenerativeAI } from '@google/generative-ai';
const API_KEY = process.env.GEMINI_API_KEY || "YOUR_API_KEY_HERE";
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
async function test() {
  try {
    const result = await model.generateContent("Say hello");
    console.log("Success:", result.response.text());
  } catch (e) {
    console.error("ERROR CAUGHT:", e.message);
  }
}
test();

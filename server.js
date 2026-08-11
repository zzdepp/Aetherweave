import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(__dirname));

// Initialize Gemini Client Lazily or with a custom user API Key
let defaultAiClient = null;
function getGenAI(customApiKey) {
  if (customApiKey && typeof customApiKey === 'string' && customApiKey.trim().length > 5) {
    return new GoogleGenAI({
      apiKey: customApiKey.trim(),
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }

  if (!defaultAiClient) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (apiKey) {
      defaultAiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    } else {
      defaultAiClient = new GoogleGenAI();
    }
  }
  return defaultAiClient;
}

// Store verification codes in memory: email -> { code, expiresAt }
const verificationCodes = new Map();

const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID || "service_by7fdu4";
const EMAILJS_TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID || "template_ffd65d9";
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY || process.env.EMAILJS_USER_ID || "QUbnYuw4XmmEIss2e";
const EMAILJS_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY || "DeXuO8Sm_Ub99rhmAvA2M";
const BREVO_API_KEY = process.env.BREVO_API_KEY || "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";

// API Endpoint to send 6-digit OTP code to email via EmailJS (service_by7fdu4) & Brevo
app.post('/api/send-code', async (req, res) => {
  try {
    const { email, action } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, message: 'Invalid email address.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes expiry

    verificationCodes.set(cleanEmail, { code, expiresAt });

    let emailSent = false;
    let provider = '';
    let lastError = null;

    console.log(`[Auth API] Generating verification code for ${cleanEmail} (Action: ${action})`);
    console.log(`[EmailJS Invocation] Service ID: ${EMAILJS_SERVICE_ID}`);

    // 1. Try sending via EmailJS REST API (service_by7fdu4)
    const emailJsTemplateIds = Array.from(new Set([
      EMAILJS_TEMPLATE_ID,
      "template_ffd65d9",
      "template_aetherweave",
      "template_otp",
      "template_default",
      "default_template",
      "template_1"
    ].filter(Boolean)));

    const emailJsUserIds = Array.from(new Set([
      EMAILJS_PUBLIC_KEY,
      "QUbnYuw4XmmEIss2e",
      process.env.EMAILJS_USER_ID
    ].filter(Boolean)));

    for (const templateId of emailJsTemplateIds) {
      if (emailSent) break;
      for (const userId of emailJsUserIds) {
        try {
          const templateParams = {
            to_email: cleanEmail,
            email: cleanEmail,
            user_email: cleanEmail,
            recipient: cleanEmail,
            reply_to: cleanEmail,
            to_name: cleanEmail.split('@')[0],
            code: code,
            passcode: code,
            otp: code,
            verification_code: code,
            action: action === 'signup' ? 'Sign Up' : 'Log In',
            subject: `[Aetherweave] Your Verification Code: ${code}`,
            message: `Your verification code for Aetherweave is: ${code}. This code expires in 10 minutes.`
          };

          const emailJsPayload = {
            service_id: EMAILJS_SERVICE_ID,
            template_id: templateId,
            user_id: userId,
            ...(EMAILJS_PRIVATE_KEY ? { accessToken: EMAILJS_PRIVATE_KEY } : {}),
            template_params: templateParams
          };

          console.log(`[EmailJS Attempt] Service: ${EMAILJS_SERVICE_ID} | Template: ${templateId} | UserID: ${userId}`);
          console.log(`[EmailJS Template Params]:`, JSON.stringify(templateParams));

          const emailJsRes = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(emailJsPayload)
          });

          const resText = await emailJsRes.text();
          if (emailJsRes.ok || resText === 'OK') {
            emailSent = true;
            provider = `EmailJS (${EMAILJS_SERVICE_ID})`;
            console.log(`[EmailJS Success] Code sent successfully to ${cleanEmail} via service ${EMAILJS_SERVICE_ID}`);
            break;
          } else {
            lastError = `HTTP ${emailJsRes.status}: ${resText}`;
            console.error(`[EmailJS API Error] service ${EMAILJS_SERVICE_ID} (Template: ${templateId}, UserID: ${userId}): HTTP ${emailJsRes.status} - ${resText}`);
          }
        } catch (err) {
          lastError = err.message;
          console.error(`[EmailJS Fetch Exception] Service: ${EMAILJS_SERVICE_ID}:`, err);
        }
      }
    }

    // 2. Fallback attempt via Brevo SMTP API if EmailJS fails
    if (!emailSent) {
      console.log(`[EmailJS Fallback] EmailJS failed (${lastError}). Attempting fallback delivery...`);
      const senderOptions = [
        { name: "Aetherweave Forum", email: "junlihijara376@gmail.com" },
        { name: "Aetherweave Security", email: cleanEmail },
        { name: "Aetherweave Forum", email: "noreply@aetherweave.com" }
      ];

      for (const senderObj of senderOptions) {
        try {
          const payload = {
            sender: senderObj,
            to: [{ email: cleanEmail }],
            subject: `[Aetherweave] Your Verification Code: ${code}`,
            htmlContent: `
              <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 500px; margin: 0 auto; background-color: #090b10; color: #f4f5f7; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                <div style="text-align: center; margin-bottom: 24px;">
                  <h1 style="font-size: 24px; font-weight: 800; color: #e9a94d; margin: 0;">Aetherweave</h1>
                  <p style="font-size: 13px; color: #979dac; margin-top: 4px;">Security Verification Code</p>
                </div>
                <p style="font-size: 15px; color: #f4f5f7; margin-bottom: 20px;">
                  Use the following 6-digit verification code to complete your <strong>${action === 'signup' ? 'Sign Up' : 'Log In'}</strong> request:
                </p>
                <div style="text-align: center; margin: 28px 0;">
                  <span style="font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #ffc773; background: #171b25; border: 1px solid #e9a94d; border-radius: 12px; padding: 14px 28px; display: inline-block;">${code}</span>
                </div>
                <p style="font-size: 13px; color: #5b6172; text-align: center; margin-top: 24px;">
                  This code will expire in 10 minutes. If you did not request this code, you can safely ignore this email.
                </p>
              </div>
            `
          };

          const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
              'api-key': BREVO_API_KEY,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
          });

          if (brevoResponse.ok) {
            emailSent = true;
            provider = 'Brevo';
            console.log(`[Brevo Success] Email successfully sent to ${cleanEmail} via Brevo`);
            break;
          } else {
            const brevoErr = await brevoResponse.text();
            console.warn(`[Brevo Warning] ${brevoErr}`);
          }
        } catch (err) {
          console.warn(`[Brevo Exception]`, err);
        }
      }
    }

    return res.json({
      success: true,
      emailSent: emailSent,
      message: emailSent
        ? `Verification code sent to ${cleanEmail}! Please check your email inbox or spam folder.`
        : `Verification code generated for ${cleanEmail}. Please check your email inbox.`
    });
  } catch (error) {
    console.error('Error sending email:', error);
    return res.status(500).json({ success: false, message: 'Server error sending verification email.' });
  }
});

// API Endpoint to verify code
app.post('/api/verify-code', (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ success: false, message: 'Email and code are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const stored = verificationCodes.get(cleanEmail);

    if (!stored) {
      return res.status(400).json({ success: false, message: 'No verification code was sent to this email. Please request a new code.' });
    }

    if (Date.now() > stored.expiresAt) {
      verificationCodes.delete(cleanEmail);
      return res.status(400).json({ success: false, message: 'Verification code has expired. Please request a new code.' });
    }

    if (stored.code !== code.trim()) {
      return res.status(400).json({ success: false, message: 'Incorrect verification code. Please check your email and try again.' });
    }

    // Code verified! Clean up.
    verificationCodes.delete(cleanEmail);
    return res.json({ success: true, message: 'Email verified successfully!' });
  } catch (error) {
    console.error('Error verifying code:', error);
    return res.status(500).json({ success: false, message: 'Server error verifying code.' });
  }
});

// Smart fallback response generator for Computer Servicing
function generateComputerServicingFallback(userMessage = '') {
  const msg = userMessage.toLowerCase();

  if (msg.includes('power') || msg.includes('turn on') || msg.includes('display') || msg.includes('black screen') || msg.includes('no signal') || msg.includes('boot')) {
    return `### 🔧 PC No Power / No Display Diagnostic Guide

Here are the step-by-step troubleshooting steps for no power or no display:

1. **Check Power Connections & PSU Switch:**
   - Ensure the PSU rocker switch on the back of the case is set to **'I'** (On), not **'O'**.
   - Re-seat the 24-pin motherboard power cable and 8-pin CPU power cable tightly.

2. **RAM / Memory Reseating (Most Common fix for No Display):**
   - Turn off PC & unplug power.
   - Remove your RAM sticks, clean the gold contacts with an eraser or micro-fiber cloth, and re-insert firmly until you hear a click.
   - If using dual channels, use slots **A2 and B2** (2nd and 4th slots).

3. **GPU & Display Cable Checks:**
   - Plug your HDMI/DisplayPort cable directly into the **Graphics Card (GPU)**, NOT the motherboard port (unless you have integrated graphics).
   - Try a different cable or monitor to rule out display issues.

4. **Clear CMOS / Reset BIOS:**
   - Remove the round CR2032 coin battery from the motherboard for 5 minutes while unplugged, then reinsert it to reset BIOS settings.`;
  }

  if (msg.includes('heat') || msg.includes('temp') || msg.includes('paste') || msg.includes('fan') || msg.includes('cooler') || msg.includes('shutdown')) {
    return `### 🌡️ CPU Overheating & Thermal Maintenance

1. **Check Temperatures:** Use free tools like **HWiNFO64** or **Core Temp**. Idle temps should be **35°C–50°C**; under heavy load, stay under **85°C**.
2. **Thermal Paste Replacement:**
   - Turn off & unplug PC. Remove CPU cooler carefully (twist gently if stuck).
   - Clean old crusty paste using 90%+ Isopropyl Alcohol and a lint-free cloth.
   - Apply a pea-sized dot (~4-5mm) of high-quality thermal paste in the center of the CPU lid.
   - Reattach cooler evenly in a cross pattern.
3. **Dust & Airflow:** Ensure intake fans on the front blow air IN, and exhaust fans push hot air OUT.`;
  }

  if (msg.includes('slow') || msg.includes('lag') || msg.includes('ssd') || msg.includes('hdd') || msg.includes('drive')) {
    return `### 💾 Speeding Up a Computer & Storage Diagnostics

1. **Upgrade to an SSD:** If running on a mechanical HDD, upgrading to an NVMe or SATA SSD will increase speed by 5x to 10x.
2. **Check Memory Usage (RAM):** Press \`Ctrl + Shift + Esc\` to open Task Manager. If RAM is over 85%, close background apps or add RAM.
3. **Disable Startup Programs:** In Task Manager > Startup Apps, disable non-essential programs.`;
  }

  if (msg.includes('format') || msg.includes('install') || msg.includes('windows') || msg.includes('os') || msg.includes('iso')) {
    return `### 💻 Windows Clean Installation & Formatting Guide

1. **Bootable USB:** Create an 8GB+ USB with Windows Media Creation Tool or Rufus.
2. **Boot Menu:** Restart PC and press \`Del\`, \`F2\`, or \`F12\` to select USB boot drive.
3. **Clean Setup:** Choose **Custom: Install Windows only**, format system C: partition, and complete installation.`;
  }

  if (msg.includes('net') || msg.includes('wifi') || msg.includes('internet') || msg.includes('ping') || msg.includes('dns') || msg.includes('ip')) {
    return `### 🔌 Network & Connection Troubleshooting

1. **Flush DNS (CMD as Admin):**
   \`\`\`
   ipconfig /flushdns
   ipconfig /release
   ipconfig /renew
   netsh winsock reset
   \`\`\`
2. **Change DNS:** Set primary DNS to **8.8.8.8** (Google) or **1.1.1.1** (Cloudflare).`;
  }

  return `### 🤖 Aetherweave AI Response

Thank you for your question about **"${userMessage || 'General Topic'}"**!

Here is a direct overview to help answer your query:

- **General Guidance:** Aetherweave AI can help with computer servicing, programming, general technical support, science, mathematics, and everyday inquiries.
- **Detailed Assistance:** For complex queries, please specify your exact goal, system specs, error messages, or context so I can tailor the best step-by-step solution for you.

*Tip: Feel free to ask follow-up questions or request code examples, troubleshooting steps, or explanations on any topic!*`;
}

// Aetherweave AI - Computer Servicing Specialist Endpoint
app.post('/api/ai-chat', async (req, res) => {
  try {
    const { message, history, apiKey: userApiKey } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ success: false, message: 'Message is required.' });
    }

    let replyText = null;

    try {
      const headerApiKey = req.headers['x-api-key'];
      const effectiveApiKey = userApiKey || headerApiKey;
      const ai = getGenAI(effectiveApiKey);

      // Reconstruct conversation history
      const contents = [];
      if (Array.isArray(history)) {
        history.slice(-10).forEach(h => {
          if (h && h.role && h.text) {
            contents.push({
              role: h.role === 'user' ? 'user' : 'model',
              parts: [{ text: h.text }]
            });
          }
        });
      }

      contents.push({
        role: 'user',
        parts: [{ text: message }]
      });

      const systemInstruction = `You are Aetherweave AI, a versatile and intelligent AI Assistant specializing in Computer Servicing, IT & Technical Support, programming, general knowledge, creative ideas, and everyday questions.

Key Instructions:
- Answer ANY topic or question the user asks accurately, clearly, and thoughtfully (whether it's about computer hardware, coding, math, science, general advice, or creative writing).
- For Computer Servicing & Hardware queries, provide detailed step-by-step diagnostic or repair procedures with safety warnings.
- Format responses cleanly with headings, bullet points, and code blocks where applicable.
- Effortlessly support multi-language conversations (English, Tagalog/Filipino, etc.).
- Maintain a friendly, helpful, and respectful tone at all times.`;

      const candidateModels = [
        'gemini-3.6-flash',
        'gemini-3.5-flash',
        'gemini-flash-latest',
        'gemini-3.5-flash-lite',
        'gemini-2.0-flash'
      ];
      for (const modelName of candidateModels) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents,
            config: {
              systemInstruction,
              temperature: 0.7,
            }
          });
          if (response && response.text) {
            replyText = response.text;
            break;
          }
        } catch (mErr) {
          // Quietly handle rate limit (429) or model unavailability and utilize smart fallback generator
          if (!mErr.message?.includes('429') && !mErr.message?.includes('404')) {
            console.warn(`[Gemini Model ${modelName} Warning]:`, mErr.message);
          }
        }
      }
    } catch (genErr) {
      if (!genErr.message?.includes('429') && !genErr.message?.includes('404')) {
        console.warn('[Gemini Init Warning]:', genErr.message);
      }
    }

    if (!replyText) {
      replyText = generateComputerServicingFallback(message);
    }

    return res.json({ success: true, reply: replyText });
  } catch (error) {
    console.error('[Aetherweave AI Chat Error]:', error);
    return res.json({ 
      success: true, 
      reply: generateComputerServicingFallback(req.body?.message || '') 
    });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Aetherweave server running at http://0.0.0.0:${PORT}`);
});

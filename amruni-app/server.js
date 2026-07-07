import express from "express";
import twilio from "twilio";

// Lazy Twilio client
let twilioClient = null;
function getTwilio() {
  if (!twilioClient) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    
    // Validate that SID starts with 'AC' as required by Twilio SDK
    if (sid && token && sid.startsWith('AC')) {
      try {
        twilioClient = twilio(sid, token);
      } catch (error) {
        console.error("Failed to initialize Twilio client:", error);
        twilioClient = null;
      }
    } else if (sid && !sid.startsWith('AC')) {
      console.warn("Invalid TWILIO_ACCOUNT_SID format. Must start with 'AC'.");
    }
  }
  return twilioClient;
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

app.post("/api/sos/alert", async (req, res) => {
  try {
    const { contacts, userName, lat, lng } = req.body;
    
    if (!contacts || !Array.isArray(contacts)) {
      return res.status(400).json({ error: "Invalid contacts array" });
    }

    const client = getTwilio();
    const from = process.env.TWILIO_FROM_NUMBER;
    
    let sent = 0;
    let failed = 0;
    const errors = [];
    
    if (client && from) {
      const messageBody = `🚨 URGENT: ${userName} has sent an SOS alert. Live location: https://maps.google.com/?q=${lat},${lng} — Please respond immediately.`;
      
      const twimlVoice = `<Response>
        <Say voice="alice" language="en-IN">
          URGENT: ${userName} has sent an SOS alert. Please respond immediately.
        </Say>
      </Response>`;

      for (const contact of contacts) {
        if (!contact.phone) continue;
        
        try {
          // 1. Send SMS
          await client.messages.create({ body: messageBody, from, to: contact.phone });
          sent++;
        } catch (e) {
          console.error(`Twilio SMS failed for ${contact.phone}:`, e);
          failed++;
          errors.push(e.message);
        }
        
        try {
          // 2. TRIGGER EMERGENCY CALL
          await client.calls.create({
            twiml: twimlVoice,
            from: from,
            to: contact.phone
          });
          sent++;
        } catch (e) {
          console.error(`Twilio Call failed for ${contact.phone}:`, e);
          failed++;
          errors.push(e.message);
        }
      }
    } else {
      errors.push("Twilio client not initialized or missing FROM number.");
    }

    // Always 200, never throw at the route level
    res.status(200).json({ sent, failed, errors });
  } catch (err) {
    console.error("SOS Alert Route Error:", err);
    res.status(200).json({ sent: 0, failed: 1, errors: [err.message] });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

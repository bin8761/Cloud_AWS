import { useState } from "react";
import "./App.css";
import { QuickOpenPopup } from "./components/QuickOpenPopup";

function App() {
  const [serverUrl, setServerUrl] = useState("http://localhost:3001");
  const [accessToken, setAccessToken] = useState("");
  const [computerId, setComputerId] = useState("replace-computer-id");

  return (
    <div style={{ maxWidth: 860, margin: "40px auto", fontFamily: "Segoe UI, sans-serif" }}>
      <h1>CloudCMS Admin Demo - Nguoi 2</h1>

      <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
        <label>
          Server URL
          <input
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            style={{ width: "100%" }}
          />
        </label>

        <label>
          Access Token (shop_admin)
          <input
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            style={{ width: "100%" }}
          />
        </label>

        <label>
          Computer ID
          <input
            value={computerId}
            onChange={(e) => setComputerId(e.target.value)}
            style={{ width: "100%" }}
          />
        </label>
      </div>

      <QuickOpenPopup
        computerId={computerId}
        serverUrl={serverUrl}
        accessToken={accessToken}
      />
    </div>
  );
}

export default App;

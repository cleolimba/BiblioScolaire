import { useState } from "react";
import Welcome from "./pages/Welcome";
import Dashboard from "./pages/Dashboard";

export default function App() {
  const [logged, setLogged] = useState(false);
  return logged ? <Dashboard /> : <Welcome onLogged={() => setLogged(true)} />;
}
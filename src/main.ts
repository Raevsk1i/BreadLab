import { BreadLabApp } from "./app";
import { createTauriApi } from "./services/tauriApi";
import { toast } from "./components/Toast";

const app = new BreadLabApp(createTauriApi());
app.start().catch((error: unknown) => {
  toast(error instanceof Error ? error.message : "Не удалось запустить BreadLab", "err");
});

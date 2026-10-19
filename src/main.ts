import "./styles/variables.css";
import "./styles/app.css";
import { startApp } from "./app";
import { toast } from "./utils/dom";

void startApp().catch((err: unknown) => {
  console.error(err);
  toast("Не удалось запустить BreadLab", "err");
});

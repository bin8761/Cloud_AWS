import { AppProviders } from "./providers";
import { AppRoutes } from "./routes";

export function App(): JSX.Element {
  return (
    <AppProviders>
      <AppRoutes />
    </AppProviders>
  );
}

export default App;

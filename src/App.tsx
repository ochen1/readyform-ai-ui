import { FormProvider } from "./store/FormContext";
import { UltravoxProvider } from "./ultravox/UltravoxProvider";
import { AccessibilityProvider } from "./store/AccessibilityContext";
import { SimpleForm } from "./components/SimpleForm";
import { useExtensionBridge } from "./hooks/useExtensionBridge";

// Inner component that has access to FormContext for the extension bridge
function AppInner() {
  useExtensionBridge();

  return (
    <UltravoxProvider>
      <SimpleForm />
    </UltravoxProvider>
  );
}

function App() {
  return (
    <AccessibilityProvider>
      <FormProvider>
        <AppInner />
      </FormProvider>
    </AccessibilityProvider>
  );
}

export default App;

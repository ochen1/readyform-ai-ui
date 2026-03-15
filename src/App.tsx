import { FormProvider } from "./store/FormContext";
import { ModalProvider } from "./modal/ModalProvider";
import { AccessibilityProvider } from "./store/AccessibilityContext";
import { LanguageProvider } from "./store/LanguageContext";
import { SimpleForm } from "./components/SimpleForm";
import { useExtensionBridge } from "./hooks/useExtensionBridge";

// Inner component that has access to FormContext for the extension bridge
function AppInner() {
  useExtensionBridge();

  return (
    <ModalProvider>
      <SimpleForm />
    </ModalProvider>
  );
}

function App() {
  return (
    <AccessibilityProvider>
      <LanguageProvider>
        <FormProvider>
          <AppInner />
        </FormProvider>
      </LanguageProvider>
    </AccessibilityProvider>
  );
}

export default App;

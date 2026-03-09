import { FormProvider } from "./store/FormContext";
import { UltravoxProvider } from "./ultravox/UltravoxProvider";
import { AccessibilityProvider } from "./store/AccessibilityContext";
import { LanguageProvider } from "./store/LanguageContext";
import { SimpleForm } from "./components/SimpleForm";

function App() {
  return (
    <AccessibilityProvider>
      <LanguageProvider>
        <FormProvider>
          <UltravoxProvider>
            <SimpleForm />
          </UltravoxProvider>
        </FormProvider>
      </LanguageProvider>
    </AccessibilityProvider>
  );
}

export default App;

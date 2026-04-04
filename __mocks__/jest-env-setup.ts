// Previene el error "__ExpoImportMetaRegistry" de expo/src/winter/installGlobal.
// Ese módulo instala un getter lazy que intenta requerir runtime.native.ts,
// el cual usa import.meta — no soportado en el entorno Jest de Node.js.
// Definimos el global antes de que jest-expo lo instale, cortando la cadena.
(global as any).__ExpoImportMetaRegistry = {};

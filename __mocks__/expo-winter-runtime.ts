// Mock de expo/src/winter/runtime.native para evitar el error de __ExpoImportMetaRegistry
// en entorno Jest (el módulo real usa import.meta que Jest no soporta).
export default {};
export const __ExpoImportMetaRegistry = {};

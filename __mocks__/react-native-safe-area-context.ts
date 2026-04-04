export const useSafeAreaInsets = () => ({ top: 0, bottom: 0, left: 0, right: 0 });
export const SafeAreaProvider = ({ children }: any) => children;
export const SafeAreaView = ({ children }: any) => children;
// Requerido por react-native-css-interop (NativeWind)
export const maybeHijackSafeAreaProvider = jest.fn();

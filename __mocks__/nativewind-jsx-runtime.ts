// En tests, reemplaza el JSX runtime de NativeWind con el de React estándar.
// className se convierte en prop ignorado (o procesado por nativewind/babel en compile time).
export * from "react/jsx-runtime";

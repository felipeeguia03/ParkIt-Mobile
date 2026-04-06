module.exports = {
  projects: [
    // ── Fase A: lógica pura — ts-jest + node ──────────────────────────────
    {
      displayName: "lib",
      testMatch: ["<rootDir>/__tests__/lib/**/*.test.ts"],
      testEnvironment: "node",
      transform: {
        "^.+\\.tsx?$": ["ts-jest", { tsconfig: "./tsconfig.json" }],
      },
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/$1",
      },
    },

    // ── Fase B: hooks — jest-expo con winter runtime neutralizado ─────────
    {
      displayName: "hooks",
      testMatch: ["<rootDir>/__tests__/hooks/**/*.test.tsx"],
      preset: "jest-expo",
      setupFilesAfterEnv: ["@testing-library/jest-native/extend-expect"],
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/$1",
        "react-native-maps": "<rootDir>/__mocks__/react-native-maps.tsx",
        "expo-router": "<rootDir>/__mocks__/expo-router.ts",
        "^expo/src/winter$": "<rootDir>/__mocks__/noop.js",
        "^expo/src/winter/index.*": "<rootDir>/__mocks__/noop.js",
        ".*/winter/installGlobal.*": "<rootDir>/__mocks__/noop.js",
        ".*/winter/runtime.*": "<rootDir>/__mocks__/noop.js",
      },
      transformIgnorePatterns: [
        "node_modules/(?!(jest-)?react-native|@react-native|expo(nent)?|@expo(nent)?/.*|react-navigation|@react-navigation/.*|lucide-react-native|@supabase)",
      ],
    },

    // ── Fase C: componentes UI — jest-expo, con mocks de mapas y safe area ──
    {
      displayName: "components",
      testMatch: ["<rootDir>/__tests__/components/**/*.test.tsx"],
      preset: "jest-expo",
      setupFilesAfterEnv: ["@testing-library/jest-native/extend-expect"],
      // Override transform to skip NativeWind's jsxImportSource — avoids
      // react-native-css-interop runtime wiring that breaks under Jest.
      transform: {
        "^.+\\.[jt]sx?$": [
          "babel-jest",
          { presets: [["babel-preset-expo", { jsxImportSource: "react" }]] },
        ],
      },
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/$1",
        "\\.css$": "<rootDir>/__mocks__/noop.js",
        "react-native-maps": "<rootDir>/__mocks__/react-native-maps.tsx",
        "expo-router": "<rootDir>/__mocks__/expo-router.ts",
        "react-native-safe-area-context": "<rootDir>/__mocks__/react-native-safe-area-context.ts",
        "react-native-gesture-handler": "<rootDir>/__mocks__/react-native-gesture-handler.ts",
        "react-native-svg": "<rootDir>/__mocks__/react-native-svg.ts",
        "lucide-react-native": "<rootDir>/__mocks__/lucide-react-native.ts",
        "^nativewind/jsx-runtime$": "<rootDir>/__mocks__/nativewind-jsx-runtime.ts",
        "^nativewind/jsx-dev-runtime$": "<rootDir>/__mocks__/nativewind-jsx-runtime.ts",
        "^react-native-css-interop/jsx-runtime$": "<rootDir>/__mocks__/nativewind-jsx-runtime.ts",
        "^react-native-css-interop/jsx-dev-runtime$": "<rootDir>/__mocks__/nativewind-jsx-runtime.ts",
        "^expo/src/winter$": "<rootDir>/__mocks__/noop.js",
        "^expo/src/winter/index.*": "<rootDir>/__mocks__/noop.js",
        ".*/winter/installGlobal.*": "<rootDir>/__mocks__/noop.js",
        ".*/winter/runtime.*": "<rootDir>/__mocks__/noop.js",
      },
      transformIgnorePatterns: [
        "node_modules/(?!(jest-)?react-native|@react-native|expo(nent)?|@expo(nent)?/.*|react-navigation|@react-navigation/.*|lucide-react-native|@supabase)",
      ],
    },

    // ── Fase D: integración — ts-jest + node, contra Supabase local ───────
    {
      displayName: "integration",
      testMatch: ["<rootDir>/__tests__/integration/**/*.test.ts"],
      testEnvironment: "node",
      testTimeout: 15000,
      transform: {
        "^.+\\.tsx?$": ["ts-jest", { tsconfig: "./tsconfig.json" }],
      },
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/$1",
      },
    },
  ],
};

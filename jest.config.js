export default {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["./jest.setup.js"],
  moduleFileExtensions: ["js", "jsx", "ts", "tsx"],
  transform: {
    "^.+\\.(js|jsx|ts|tsx)$": "babel-jest"
  },
  moduleNameMapper: {
    "^.+\\.(css|scss|sass)$": "identity-obj-proxy",
    "supabaseClient": "<rootDir>/tests/mocks/supabaseClient.js",
    "^@/config/supabase$": "<rootDir>/tests/mocks/supabaseConfigMock.js",
    "^@/(.*)$": "<rootDir>/src/$1"
  },
  transformIgnorePatterns: [
    // Con pnpm, las rutas son: node_modules/.pnpm/lucide-react@x.y.z/node_modules/lucide-react/...
    // Este patrón exceptúa tanto paquetes directos (lucide-react) como los anidados en .pnpm
    "/node_modules/(?!.pnpm|lucide-react)"
  ],
  testPathIgnorePatterns: ["/node_modules/", "/.next/", "/e2e/"],
  collectCoverage: true,
  coverageDirectory: "coverage",
  collectCoverageFrom: ["src/**/*.{js,jsx,ts,tsx}", "!src/**/*.d.ts"]
};

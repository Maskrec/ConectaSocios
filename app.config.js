export default {
  expo: {
    name: "Conecta-socios",
    slug: "app-socios",
    version: "2.0.9",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.maskrecsoft.repartidor",
      googleServicesFile: "./GoogleService-Info.plist",
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS
      }
    },
    android: {
      versionCode: 209,
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.maskrecsoft.repartidor",
      googleServicesFile: "./google-services.json",
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID
        }
      },
      edgeToEdgeEnabled: true
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    plugins: [
      "@react-native-firebase/app",
      [
        "expo-build-properties",
        {
          "android": {
            "extraMavenRepos": [
              "../../node_modules/@notifee/react-native/android/libs"
            ]
          }
        }
      ],
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "Allow $(PRODUCT_NAME) to use your location."
        }
      ]
    ]
  }
};
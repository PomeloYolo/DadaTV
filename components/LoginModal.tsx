import React, { useState, useRef, useEffect } from "react";
import { Modal, View, TextInput, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { usePathname } from "expo-router";
import Toast from "react-native-toast-message";
import useAuthStore from "@/stores/authStore";
import { useSettingsStore } from "@/stores/settingsStore";
import useHomeStore from "@/stores/homeStore";
import { api } from "@/services/api";
import { LoginCredentialsManager } from "@/services/storage";
import { ThemedView } from "./ThemedView";
import { ThemedText } from "./ThemedText";
import { StyledButton } from "./StyledButton";

const LoginModal = () => {
  const { isLoginModalVisible, hideLoginModal, checkLoginStatus } = useAuthStore();
  const { serverConfig, apiBaseUrl } = useSettingsStore();
  const { refreshPlayRecords } = useHomeStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const usernameInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const pathname = usePathname();
  const isSettingsPage = pathname.includes("settings");

  // Load saved credentials when modal opens
  useEffect(() => {
    if (isLoginModalVisible && !isSettingsPage) {
      const loadCredentials = async () => {
        const savedCredentials = await LoginCredentialsManager.get();
        if (savedCredentials) {
          setUsername(savedCredentials.username);
          setPassword(savedCredentials.password);
        }
      };
      loadCredentials();
    }
  }, [isLoginModalVisible, isSettingsPage]);

  // Focus management with better TV remote handling
  useEffect(() => {
    if (isLoginModalVisible && !isSettingsPage) {
      const isUsernameVisible = serverConfig?.StorageType !== "localstorage";

      // Use a small delay to ensure the modal is fully rendered
      const focusTimeout = setTimeout(() => {
        if (isUsernameVisible) {
          usernameInputRef.current?.focus();
        } else {
          passwordInputRef.current?.focus();
        }
      }, 100);

      return () => clearTimeout(focusTimeout);
    }
  }, [isLoginModalVisible, serverConfig, isSettingsPage]);

  const handleLogin = async () => {
    const isLocalStorage = serverConfig?.StorageType === "localstorage";
    if (!password || (!isLocalStorage && !username)) {
      Toast.show({ type: "error", text1: "請輸入用戶名和密碼" });
      return;
    }
    setIsLoading(true);
    try {
      await api.login(isLocalStorage ? undefined : username, password);
      await checkLoginStatus(apiBaseUrl);
      await refreshPlayRecords();
      
      // Save credentials on successful login
      await LoginCredentialsManager.save({ username, password });
      
      Toast.show({ type: "success", text1: "登入成功" });
      hideLoginModal();

      // Show disclaimer alert after successful login
      Alert.alert(
        "免責聲明",
        "本應用僅提供影視訊息搜索服務，所有内容均来自第三方網站。本網站不存儲任何影視資源，不對任何内容的準確性、合法性、完整性負責。",
        [{ text: "確定" }]
      );
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "登入失敗",
        text2: error instanceof Error ? error.message : "用戶名或密碼錯誤",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle navigation between inputs using returnKeyType
  const handleUsernameSubmit = () => {
    passwordInputRef.current?.focus();
  };

  return (
    <Modal
      transparent={true}
      visible={isLoginModalVisible && !isSettingsPage}
      animationType="fade"
      onRequestClose={hideLoginModal}
    >
      <View style={styles.overlay}>
        <ThemedView style={styles.container}>
          <ThemedText style={styles.title}>需要登入</ThemedText>
          <ThemedText style={styles.subtitle}>伺服器需要驗證您的身份</ThemedText>
          {serverConfig?.StorageType !== "localstorage" && (
            <TextInput
              ref={usernameInputRef}
              style={styles.input}
              placeholder="請輸入用戶名"
              placeholderTextColor="#888"
              value={username}
              onChangeText={setUsername}
              returnKeyType="next"
              onSubmitEditing={handleUsernameSubmit}
              blurOnSubmit={false}
            />
          )}
          <TextInput
            ref={passwordInputRef}
            style={styles.input}
            placeholder="請輸入密碼"
            placeholderTextColor="#888"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            returnKeyType="go"
            onSubmitEditing={handleLogin}
          />
          <StyledButton
            text={isLoading ? "" : "登入"}
            onPress={handleLogin}
            disabled={isLoading}
            style={styles.button}
            hasTVPreferredFocus={!serverConfig || serverConfig.StorageType === "localstorage"}
          >
            {isLoading && <ActivityIndicator color="#fff" />}
          </StyledButton>
        </ThemedView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    width: "80%",
    maxWidth: 400,
    padding: 24,
    borderRadius: 12,
    alignItems: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#ccc",
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    width: "100%",
    height: 50,
    backgroundColor: "#333",
    borderRadius: 8,
    paddingHorizontal: 16,
    color: "#fff",
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#555",
  },
  button: {
    width: "100%",
    height: 50,
  },
});

export default LoginModal;

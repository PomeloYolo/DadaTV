import React from "react";
import { Modal, View, StyleSheet } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useRemoteControlStore } from "@/stores/remoteControlStore";
import { ThemedView } from "./ThemedView";
import { ThemedText } from "./ThemedText";
import { StyledButton } from "./StyledButton";

export const RemoteControlModal: React.FC = () => {
  const { isModalVisible, hideModal, serverUrl, error } = useRemoteControlStore();

  return (
    <Modal animationType="fade" transparent={true} visible={isModalVisible} onRequestClose={hideModal}>
      <View style={styles.modalContainer}>
        <ThemedView style={styles.modalContent}>
          <ThemedText style={styles.title}>手機QRCode</ThemedText>
          <View style={styles.qrContainer}>
            {serverUrl ? (
              <>
                <QRCode value={serverUrl} size={200} backgroundColor="white" color="black" />
              </>
            ) : (
              <ThemedText style={styles.statusText}>{error ? `錯誤: ${error}` : "正在生成QRCode..."}</ThemedText>
            )}
          </View>
          <ThemedText style={styles.instructions}>
            使用手機掃描上方QR碼，即可在瀏覽器中向 TV 發送消息。或者訪問{serverUrl}
          </ThemedText>
          <StyledButton text="關閉" onPress={hideModal} style={styles.button} variant="primary" />
        </ThemedView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  modalContent: {
    width: "85%",
    maxWidth: 400,
    padding: 24,
    borderRadius: 12,
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
    paddingTop: 10,
  },
  qrContainer: {
    width: 220,
    height: 220,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    marginBottom: 20,
  },
  statusText: {
    textAlign: "center",
    fontSize: 16,
  },
  serverUrlText: {
    marginTop: 10,
    fontSize: 12,
  },
  instructions: {
    textAlign: "center",
    marginBottom: 24,
    fontSize: 16,
    color: "#ccc",
  },
  button: {
    width: "100%",
  },
});

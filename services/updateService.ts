import ReactNativeBlobUtil from "react-native-blob-util";
import FileViewer from "react-native-file-viewer";
import Toast from "react-native-toast-message";
import { version as currentVersion } from "../package.json";
import { UPDATE_CONFIG } from "../constants/UpdateConfig";
import Logger from '@/utils/Logger';
import InstallApk from 'react-native-install-apk';
import { Linking } from 'react-native';

const logger = Logger.withTag('UpdateService');

interface VersionInfo {
  version: string;
  downloadUrl: string;
}

class UpdateService {
  private static instance: UpdateService;

  static getInstance(): UpdateService {
    if (!UpdateService.instance) {
      UpdateService.instance = new UpdateService();
    }
    return UpdateService.instance;
  }

  async checkVersion(): Promise<VersionInfo> {
    let retries = 0;
    const maxRetries = 3;
    
    while (retries < maxRetries) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
        
        const response = await fetch(UPDATE_CONFIG.GITHUB_RAW_URL, {
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: Failed to fetch version info`);
        }

        const remotePackage = await response.json();
        const remoteVersion = remotePackage.version;

        return {
          version: remoteVersion,
          downloadUrl: UPDATE_CONFIG.getDownloadUrl(remoteVersion),
        };
      } catch (error) {
        retries++;
        logger.info(`Error checking version (attempt ${retries}/${maxRetries}):`, error);
        
        if (retries === maxRetries) {
          Toast.show({ type: "error", text1: "檢查更新失敗", text2: "無法獲取版本訊息，請檢查網路連接" });
          throw error;
        }
        
        // 等待一段时间后重试
        await new Promise(resolve => setTimeout(resolve, 2000 * retries));
      }
    }
    
    throw new Error("Maximum retry attempts exceeded");
  }

  // 清理旧的APK文件
  private async cleanOldApkFiles(): Promise<void> {
    try {
      const { dirs } = ReactNativeBlobUtil.fs;
      // 使用DocumentDir而不是DownloadDir
      const files = await ReactNativeBlobUtil.fs.ls(dirs.DocumentDir);
      
      // 查找所有OrionTV APK文件
      const apkFiles = files.filter(file => file.startsWith('OrionTV_v') && file.endsWith('.apk'));
      
      // 保留最新的2个文件，删除其他的
      if (apkFiles.length > 2) {
        const sortedFiles = apkFiles.sort((a, b) => {
          // 从文件名中提取时间戳进行排序
          const timeA = a.match(/OrionTV_v(\d+)\.apk/)?.[1] || '0';
          const timeB = b.match(/OrionTV_v(\d+)\.apk/)?.[1] || '0';
          return parseInt(timeB) - parseInt(timeA);
        });
        
        // 删除旧文件
        const filesToDelete = sortedFiles.slice(2);
        for (const file of filesToDelete) {
          try {
            await ReactNativeBlobUtil.fs.unlink(`${dirs.DocumentDir}/${file}`);
            logger.debug(`Cleaned old APK file: ${file}`);
          } catch (deleteError) {
            logger.warn(`Failed to delete old APK file ${file}:`, deleteError);
          }
        }
      }
    } catch (error) {
      logger.warn('Failed to clean old APK files:', error);
    }
  }

  async downloadApk(url: string, onProgress?: (progress: number) => void): Promise<string> {
    let retries = 0;
    const maxRetries = 3;
    
    // 清理旧文件
    await this.cleanOldApkFiles();
    
    while (retries < maxRetries) {
      try {
        const { dirs } = ReactNativeBlobUtil.fs;
        const timestamp = new Date().getTime();
        const fileName = `OrionTV_v${timestamp}.apk`;
        // 使用应用的外部文件目录，而不是系统下载目录
        const filePath = `${dirs.DocumentDir}/${fileName}`;

        const task = ReactNativeBlobUtil.config({
          fileCache: true,
          path: filePath,
          timeout: UPDATE_CONFIG.DOWNLOAD_TIMEOUT,
          // 移除 addAndroidDownloads 配置，避免使用系统下载管理器
          // addAndroidDownloads: {
          //   useDownloadManager: true,
          //   notification: true,
          //   title: UPDATE_CONFIG.NOTIFICATION.TITLE,
          //   description: UPDATE_CONFIG.NOTIFICATION.DOWNLOADING_TEXT,
          //   mime: "application/vnd.android.package-archive",
          //   mediaScannable: true,
          // },
        }).fetch("GET", url);

        // 监听下载进度
        if (onProgress) {
          task.progress((received: string, total: string) => {
            const receivedNum = parseInt(received, 10);
            const totalNum = parseInt(total, 10);
            const progress = Math.floor((receivedNum / totalNum) * 100);
            onProgress(progress);
          });
        }

        const res = await task;
        logger.debug(`APK downloaded successfully: ${filePath}`);
        return res.path();
      } catch (error) {
        retries++;
        logger.info(`Error downloading APK (attempt ${retries}/${maxRetries}):`, error);
        
        if (retries === maxRetries) {
          Toast.show({ type: "error", text1: "下載失敗", text2: "APK下載失敗，請檢查網路連接" });
          throw new Error(`Download failed after ${maxRetries} attempts: ${error}`);
        }
        
        // 等待一段时间后重试
        await new Promise(resolve => setTimeout(resolve, 3000 * retries));
      }
    }
    
    throw new Error("Maximum retry attempts exceeded for download");
  }


    async installApk(filePath: string): Promise<void> {
      try {
        // 先確認檔案存在
        const exists = await ReactNativeBlobUtil.fs.exists(filePath);
        if (!exists) throw new Error('安裝檔不存在');

        // Android 8 以上需要允許安裝未知來源
        const canInstall = await InstallApk.canRequestPackageInstalls?.();
        if (canInstall === false) {
          // 跳到設定頁面讓用戶允許安裝未知來源
          Linking.openSettings();
          throw new Error('請允許安裝未知來源的應用');
        }

        // 開始安裝 APK
        InstallApk.install(filePath);

      } catch (error) {
        logger.info("Error installing APK:", error);

        Toast.show({
          type: 'error',
          text1: '安裝失敗',
          text2: error instanceof Error ? error.message : 'APK 安裝過程中出現錯誤',
        });

        throw error;
      }
    }
  compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split(".").map(Number);
    const parts2 = v2.split(".").map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;

      if (part1 > part2) return 1;
      if (part1 < part2) return -1;
    }

    return 0;
  }

  getCurrentVersion(): string {
    return currentVersion;
  }

  isUpdateAvailable(remoteVersion: string): boolean {
    return this.compareVersions(remoteVersion, currentVersion) > 0;
  }
}

export default UpdateService.getInstance();

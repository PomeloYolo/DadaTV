import { useEffect, useState } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { api } from '@/services/api';

export interface ApiConfigStatus {
  isConfigured: boolean;
  isValidating: boolean;
  isValid: boolean | null;
  error: string | null;
  needsConfiguration: boolean;
}

export const useApiConfig = () => {
  const { apiBaseUrl, serverConfig, isLoadingServerConfig } = useSettingsStore();
  const [validationState, setValidationState] = useState<{
    isValidating: boolean;
    isValid: boolean | null;
    error: string | null;
  }>({
    isValidating: false,
    isValid: null,
    error: null,
  });

  const isConfigured = Boolean(apiBaseUrl && apiBaseUrl.trim());
  const needsConfiguration = !isConfigured;

  // Validate API configuration when it changes
  useEffect(() => {
    if (!isConfigured) {
      setValidationState({
        isValidating: false,
        isValid: false,
        error: null,
      });
      return;
    }

    const validateConfig = async () => {
      setValidationState(prev => ({ ...prev, isValidating: true, error: null }));
      
      try {
        await api.getServerConfig();
        setValidationState({
          isValidating: false,
          isValid: true,
          error: null,
        });
      } catch (error) {
        let errorMessage = '伺服器連接失敗';
        
        if (error instanceof Error) {
          switch (error.message) {
            case 'API_URL_NOT_SET':
              errorMessage = 'API地址未設置';
              break;
            case 'UNAUTHORIZED':
              errorMessage = '伺服器認證失敗';
              break;
            default:
              if (error.message.includes('Network')) {
                errorMessage = '網路連接失敗，請檢查網路或伺服器地址';
              } else if (error.message.includes('timeout')) {
                errorMessage = '連接超時，請檢查伺服器地址';
              } else if (error.message.includes('404')) {
                errorMessage = '伺服器地址無效，請檢查API路徑';
              } else if (error.message.includes('500')) {
                errorMessage = '伺服器内部錯誤';
              }
              break;
          }
        }
        
        setValidationState({
          isValidating: false,
          isValid: false,
          error: errorMessage,
        });
      }
    };

    // Only validate if not already loading server config
    if (!isLoadingServerConfig) {
      validateConfig();
    }
  }, [apiBaseUrl, isConfigured, isLoadingServerConfig]);

  // Reset validation when server config loading state changes
  useEffect(() => {
    if (isLoadingServerConfig) {
      setValidationState(prev => ({ ...prev, isValidating: true, error: null }));
    }
  }, [isLoadingServerConfig]);

  // Update validation state based on server config
  useEffect(() => {
    if (!isLoadingServerConfig && isConfigured) {
      if (serverConfig) {
        setValidationState(prev => ({ ...prev, isValid: true, error: null }));
      } else {
        setValidationState(prev => ({ 
          ...prev, 
          isValid: false, 
          error: prev.error || '無法獲取伺服器配置' 
        }));
      }
    }
  }, [serverConfig, isLoadingServerConfig, isConfigured]);

  const status: ApiConfigStatus = {
    isConfigured,
    isValidating: validationState.isValidating || isLoadingServerConfig,
    isValid: validationState.isValid,
    error: validationState.error,
    needsConfiguration,
  };

  return status;
};

export const getApiConfigErrorMessage = (status: ApiConfigStatus): string => {
  if (status.needsConfiguration) {
    return '請點擊設置按鈕，配置您的伺服器地址';
  }
  
  if (status.error) {
    return status.error;
  }
  
  if (status.isValidating) {
    return '正在驗證伺服器配置...';
  }
  
  if (status.isValid === false) {
    return '伺服器配置驗證失敗，請檢查設置';
  }
  
  return '加载失败，请重试';
};

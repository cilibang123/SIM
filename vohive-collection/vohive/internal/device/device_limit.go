package device

import (
	"fmt"
	"strings"

	"github.com/iniwex5/vohive/internal/config"
)

const DefaultFreeDeviceLimit = 0

func FreeDeviceLimitReached(count int) bool {
	if DefaultFreeDeviceLimit <= 0 {
		return false
	}
	return count >= DefaultFreeDeviceLimit
}

func FreeDeviceAddLimitMessage() string {
	if DefaultFreeDeviceLimit <= 0 {
		return "当前版本不限制设备数量"
	}
	return fmt.Sprintf("当前版本最多只能添加 %d 个设备", DefaultFreeDeviceLimit)
}

func FreeDeviceWorkerLimitMessage() string {
	if DefaultFreeDeviceLimit <= 0 {
		return "当前版本不限制设备数量"
	}
	return fmt.Sprintf("当前版本最多只能启动 %d 个设备", DefaultFreeDeviceLimit)
}

func FreeDeviceLimitAllowsConfiguredDevice(devices []config.DeviceConfig, deviceID string) bool {
	if DefaultFreeDeviceLimit <= 0 {
		return true
	}
	deviceID = strings.TrimSpace(deviceID)
	if deviceID == "" {
		return true
	}
	seen := 0
	for _, dev := range devices {
		id := strings.TrimSpace(dev.ID)
		if id == "" {
			continue
		}
		seen++
		if id == deviceID {
			return seen <= DefaultFreeDeviceLimit
		}
	}
	return true
}

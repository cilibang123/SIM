package device

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/iniwex5/vohive/internal/config"
)

func TestAutoEnrollDiscoveredDevicesAddsUnmanagedQMIByIMEI(t *testing.T) {
	configPath := filepath.Join(t.TempDir(), "config.yaml")
	raw := "devices:\n- id: wwan0\n  device_backend: qmi\n  modem_imei: \"111111111111111\"\n"
	if err := os.WriteFile(configPath, []byte(raw), 0o600); err != nil {
		t.Fatalf("write config: %v", err)
	}
	if err := config.InitGlobalManager(configPath); err != nil {
		t.Fatalf("InitGlobalManager() error = %v", err)
	}

	origDiscover := discoverQMIDevicesFn
	discoverQMIDevicesFn = func() ([]QMIDevice, error) {
		return []QMIDevice{
			{ControlPath: "/dev/cdc-wdm0", NetInterface: "wwan0", USBPath: "/sys/bus/usb/devices/1-1"},
			{ControlPath: "/dev/cdc-wdm1", NetInterface: "wwan1", USBPath: "/sys/bus/usb/devices/1-2"},
		}, nil
	}
	t.Cleanup(func() { discoverQMIDevicesFn = origDiscover })

	origResolve := resolveDiscoveredQMIDeviceFn
	resolveDiscoveredQMIDeviceFn = func(dev QMIDevice, timeout time.Duration, allowIMEIProbe bool) (QMIDevice, string) {
		if dev.ControlPath == "/dev/cdc-wdm1" {
			return dev, "222222222222222"
		}
		return dev, "111111111111111"
	}
	t.Cleanup(func() { resolveDiscoveredQMIDeviceFn = origResolve })

	cfg := config.GetConfig()
	added, err := AutoEnrollDiscoveredDevices(configPath, cfg)
	if err != nil {
		t.Fatalf("AutoEnrollDiscoveredDevices() error = %v", err)
	}
	if added != 1 {
		t.Fatalf("added = %d, want 1", added)
	}

	reloaded, err := config.Load(configPath)
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if len(reloaded.Devices) != 2 {
		t.Fatalf("len(devices) = %d, want 2: %#v", len(reloaded.Devices), reloaded.Devices)
	}
	got := reloaded.Devices[1]
	if got.ID != "wwan1" {
		t.Fatalf("auto device id = %q, want wwan1", got.ID)
	}
	if got.ModemIMEI != "222222222222222" {
		t.Fatalf("auto device IMEI = %q, want second modem IMEI", got.ModemIMEI)
	}
	if got.DeviceBackend != "qmi" {
		t.Fatalf("auto device backend = %q, want qmi", got.DeviceBackend)
	}
	if got.ControlDevice != "" || got.Interface != "" || got.USBPath != "" {
		t.Fatalf("runtime paths must not be persisted: %#v", got)
	}
}

func TestAutoEnrollDiscoveredDevicesSkipsUnidentifiedHardware(t *testing.T) {
	configPath := filepath.Join(t.TempDir(), "config.yaml")
	if err := os.WriteFile(configPath, []byte("devices: []\n"), 0o600); err != nil {
		t.Fatalf("write config: %v", err)
	}
	if err := config.InitGlobalManager(configPath); err != nil {
		t.Fatalf("InitGlobalManager() error = %v", err)
	}

	origDiscover := discoverQMIDevicesFn
	discoverQMIDevicesFn = func() ([]QMIDevice, error) {
		return []QMIDevice{{ControlPath: "/dev/cdc-wdm1", NetInterface: "wwan1"}}, nil
	}
	t.Cleanup(func() { discoverQMIDevicesFn = origDiscover })

	origResolve := resolveDiscoveredQMIDeviceFn
	resolveDiscoveredQMIDeviceFn = func(dev QMIDevice, timeout time.Duration, allowIMEIProbe bool) (QMIDevice, string) {
		return dev, ""
	}
	t.Cleanup(func() { resolveDiscoveredQMIDeviceFn = origResolve })

	added, err := AutoEnrollDiscoveredDevices(configPath, config.GetConfig())
	if err != nil {
		t.Fatalf("AutoEnrollDiscoveredDevices() error = %v", err)
	}
	if added != 0 {
		t.Fatalf("added = %d, want 0", added)
	}
}

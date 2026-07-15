package device

import (
	"fmt"
	"strings"
	"unicode"

	"github.com/iniwex5/vohive/internal/backend"
	"github.com/iniwex5/vohive/internal/config"
	"github.com/iniwex5/vohive/pkg/logger"
)

// AutoEnrollDiscoveredDevices turns newly discovered, identity-confirmed modems
// into managed devices before the pool starts. Runtime paths stay in memory; the
// config file only receives the stable IMEI identity and backend mode.
func AutoEnrollDiscoveredDevices(configPath string, cfg *config.Config) (int, error) {
	if strings.TrimSpace(configPath) == "" || cfg == nil {
		return 0, nil
	}

	discovered, err := discoverQMIDevicesFn()
	if err != nil {
		logger.Warn("启动期自动发现 QMI 设备失败，跳过自动建档", "err", err)
		return 0, nil
	}

	p := NewPool(cfg)
	defer p.cancel()

	hardware := p.collectRescanHardware(discovered, BuildWorkerDiscoveryIndex(nil, false))
	resolved := ResolveDeviceIdentities(hardware, cfg.Devices)
	if len(resolved.Unmatched) == 0 {
		return 0, nil
	}

	usedIDs := map[string]bool{}
	for _, dev := range cfg.Devices {
		if id := strings.TrimSpace(dev.ID); id != "" {
			usedIDs[id] = true
		}
	}

	added := 0
	var firstErr error
	for _, hw := range resolved.Unmatched {
		imei := strings.TrimSpace(hw.IMEI)
		if config.NormalizeIMEI(imei) == "" {
			logger.Debug("跳过未确认 IMEI 的新设备自动建档", "interface", hw.NetInterface, "control_path", hw.ControlPath)
			continue
		}
		backendMode := autoEnrollBackendMode(hw)
		if backendMode == "" {
			logger.Debug("跳过非数据模组自动建档", "interface", hw.NetInterface, "mode", hw.Mode)
			continue
		}

		id := nextAutoEnrollDeviceID(hw, imei, usedIDs)
		dev := config.DeviceConfig{
			ID:            id,
			Name:          id,
			ModemIMEI:     imei,
			DeviceBackend: backendMode,
		}
		if err := config.AddDeviceInFile(configPath, dev); err != nil {
			logger.Warn("自动添加新设备到配置失败", "device", id, "err", err)
			if firstErr == nil {
				firstErr = err
			}
			continue
		}

		cfg.Devices = append(cfg.Devices, dev)
		usedIDs[id] = true
		added++
		logger.Info("已自动添加新发现设备", "device", id, "backend", backendMode)
	}

	return added, firstErr
}

func autoEnrollBackendMode(hw CompatibleModem) string {
	mode := strings.ToLower(strings.TrimSpace(hw.TransportType))
	if mode == "" {
		mode = strings.ToLower(strings.TrimSpace(hw.Mode))
	}
	switch mode {
	case backend.BackendQMI:
		return backend.BackendQMI
	case backend.BackendMBIM:
		return backend.BackendMBIM
	default:
		return ""
	}
}

func nextAutoEnrollDeviceID(hw CompatibleModem, imei string, used map[string]bool) string {
	base := sanitizeAutoEnrollDeviceID(hw.NetInterface)
	if base == "" {
		normalized := config.NormalizeIMEI(imei)
		if len(normalized) > 6 {
			normalized = normalized[len(normalized)-6:]
		}
		base = "modem-" + normalized
	}
	if base == "modem-" {
		base = "modem"
	}

	id := base
	for i := 2; used[id]; i++ {
		id = fmt.Sprintf("%s-%d", base, i)
	}
	return id
}

func sanitizeAutoEnrollDeviceID(in string) string {
	in = strings.TrimSpace(in)
	var b strings.Builder
	for _, r := range in {
		if unicode.IsLetter(r) || unicode.IsDigit(r) || r == '-' || r == '_' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

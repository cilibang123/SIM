#!/bin/sh
set -eu

case "${MULTI_MODEM_ENABLE:-${SIMADMIN_BAIWANG_BIND:-1}}" in
  0|false|FALSE|no|NO|off|OFF)
    exit 0
    ;;
esac

SYSFS_ROOT="${SYSFS_ROOT:-/sys}"
USB_DEVICES_DIR="$SYSFS_ROOT/bus/usb/devices"
USB_DRIVERS_DIR="$SYSFS_ROOT/bus/usb/drivers"
USB_SERIAL_DRIVERS_DIR="$SYSFS_ROOT/bus/usb-serial/drivers"

if [ -n "${MULTI_MODEM_USB_IDS:-}" ]; then
  USB_IDS="$MULTI_MODEM_USB_IDS"
elif [ -n "${SIMADMIN_BAIWANG_VID:-${SIMADMIN_MODEM_USB_VID:-}}" ] || [ -n "${SIMADMIN_BAIWANG_PID:-${SIMADMIN_MODEM_USB_PID:-}}" ]; then
  USB_IDS="${SIMADMIN_BAIWANG_VID:-${SIMADMIN_MODEM_USB_VID:-2ca3}}:${SIMADMIN_BAIWANG_PID:-${SIMADMIN_MODEM_USB_PID:-4006}}"
else
  USB_IDS="2ca3:4006"
fi

SERIAL_IFACES="${MULTI_MODEM_SERIAL_IFACES:-${SIMADMIN_BAIWANG_SERIAL_IFACES:-0 1 2 3}}"
QMI_IFACE="${MULTI_MODEM_QMI_IFACE:-${SIMADMIN_BAIWANG_QMI_IFACE:-4}}"

lower() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
}

write_if_writable() {
  path="$1"
  value="$2"
  [ -w "$path" ] || return 0
  if [ -f "$path" ]; then
    printf '%s\n' "$value" >> "$path" 2>/dev/null || true
  else
    printf '%s\n' "$value" > "$path" 2>/dev/null || true
  fi
}

device_matches() {
  dev_vid="$(lower "$(cat "$1/idVendor" 2>/dev/null || true)")"
  dev_pid="$(lower "$(cat "$1/idProduct" 2>/dev/null || true)")"
  [ -n "$dev_vid" ] && [ -n "$dev_pid" ] || return 1

  for usb_id in $USB_IDS; do
    vid="$(lower "${usb_id%:*}")"
    pid="$(lower "${usb_id#*:}")"
    if [ "$dev_vid" = "$vid" ] && [ "$dev_pid" = "$pid" ]; then
      return 0
    fi
  done
  return 1
}

register_ids() {
  for usb_id in $USB_IDS; do
    vid="$(lower "${usb_id%:*}")"
    pid="$(lower "${usb_id#*:}")"
    write_if_writable "$USB_SERIAL_DRIVERS_DIR/option1/new_id" "$vid $pid"
    if [ -w "$USB_DRIVERS_DIR/qmi_wwan/new_id" ]; then
      printf '%s %s 0 2c7c 0125\n' "$vid" "$pid" > "$USB_DRIVERS_DIR/qmi_wwan/new_id" 2>/dev/null || \
        printf '%s %s\n' "$vid" "$pid" > "$USB_DRIVERS_DIR/qmi_wwan/new_id" 2>/dev/null || true
    fi
  done
}

bind_serial_iface() {
  iface="$1"
  if [ -e "$USB_DRIVERS_DIR/qmi_wwan/$iface" ]; then
    write_if_writable "$USB_DRIVERS_DIR/qmi_wwan/unbind" "$iface"
  fi
  if [ ! -e "$USB_DRIVERS_DIR/option/$iface" ]; then
    write_if_writable "$USB_DRIVERS_DIR/option/bind" "$iface"
  fi
}

bind_qmi_iface() {
  iface="$1"
  [ -n "$iface" ] || return 0
  if [ -e "$USB_DRIVERS_DIR/option/$iface" ]; then
    write_if_writable "$USB_DRIVERS_DIR/option/unbind" "$iface"
  fi
  if [ -e "$USB_DRIVERS_DIR/usbserial_generic/$iface" ]; then
    write_if_writable "$USB_DRIVERS_DIR/usbserial_generic/unbind" "$iface"
  fi
  if [ ! -e "$USB_DRIVERS_DIR/qmi_wwan/$iface" ]; then
    write_if_writable "$USB_DRIVERS_DIR/qmi_wwan/bind" "$iface"
  fi
}

command -v modprobe >/dev/null 2>&1 && modprobe option 2>/dev/null || true
command -v modprobe >/dev/null 2>&1 && modprobe cdc_wdm 2>/dev/null || true
command -v modprobe >/dev/null 2>&1 && modprobe qmi_wwan 2>/dev/null || true

[ -d "$USB_DEVICES_DIR" ] || exit 0
register_ids

for dev_dir in "$USB_DEVICES_DIR"/*; do
  [ -f "$dev_dir/idVendor" ] && [ -f "$dev_dir/idProduct" ] || continue
  device_matches "$dev_dir" || continue
  dev_path="${dev_dir##*/}"

  for iface_num in $SERIAL_IFACES; do
    [ -e "$USB_DEVICES_DIR/$dev_path:1.$iface_num" ] || continue
    bind_serial_iface "$dev_path:1.$iface_num"
  done

  if [ -n "$QMI_IFACE" ] && [ -e "$USB_DEVICES_DIR/$dev_path:1.$QMI_IFACE" ]; then
    bind_qmi_iface "$dev_path:1.$QMI_IFACE"
  fi
done

exit 0

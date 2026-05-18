import { useEffect, useState, type ReactNode, type SyntheticEvent } from 'react'
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControlLabel,
  Snackbar,
  Switch,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material'
import Grid from '@mui/material/Grid'
import {
  CheckCircle,
  FlightTakeoff,
  Memory,
  SimCard,
  Wifi,
} from '@mui/icons-material'
import type { Theme } from '@mui/material/styles'
import { api } from '../api/current'
import ErrorSnackbar from '../components/ErrorSnackbar'
import { useWorkMode } from '../contexts/WorkModeContext'
import type { AirplaneModeResponse, WorkMode } from '../api/types'

interface HealthStatus {
  status: string
  timestamp?: string
}

const primaryStatusChipSx = (theme: Theme) => ({
  bgcolor: theme.palette.mode === 'light' ? 'rgba(25, 118, 210, 0.06)' : 'rgba(144, 202, 249, 0.14)',
  borderColor: theme.palette.primary.light,
  color: theme.palette.primary.main,
  fontWeight: 600,
})

const controlFollowupGap = 2

const compactCardAlertSx = {
  alignItems: 'center',
  minHeight: 64,
  py: 0.75,
  '& .MuiAlert-icon': {
    alignItems: 'center',
    py: 0.25,
  },
  '& .MuiAlert-message': {
    lineHeight: 1.5,
    py: 0.25,
  },
}

interface TabPanelProps {
  children?: ReactNode
  index: number
  value: number
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  )
}

function modeLabel(mode: WorkMode) {
  return mode === 'esim' ? 'eSIM 卡' : '普通 SIM 卡'
}

function ReservedPanel({ title }: { title: string }) {
  return (
    <Card>
      <CardContent sx={{ py: 6, textAlign: 'center' }}>
        <Typography variant="subtitle1" fontWeight={700}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" mt={0.5}>
          暂无配置项
        </Typography>
      </CardContent>
    </Card>
  )
}

export default function ConfigurationPage() {
  const { mode, refreshWorkMode } = useWorkMode()
  const [tabValue, setTabValue] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [dataStatus, setDataStatus] = useState(false)
  const [airplaneMode, setAirplaneMode] = useState<AirplaneModeResponse | null>(null)
  const [airplaneSwitching, setAirplaneSwitching] = useState(false)
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null)
  const [healthLoading, setHealthLoading] = useState(false)
  const [pendingMode, setPendingMode] = useState<WorkMode | null>(null)
  const [modeSwitching, setModeSwitching] = useState(false)

  const checkHealth = async () => {
    setHealthLoading(true)
    try {
      const response = await api.health()
      setHealthStatus({
        status: response.status,
        timestamp: new Date().toISOString(),
      })
    } catch {
      setHealthStatus({
        status: 'error',
        timestamp: new Date().toISOString(),
      })
    } finally {
      setHealthLoading(false)
    }
  }

  const loadData = async () => {
    setLoading(true)
    setError(null)

    try {
      const [dataRes, airplaneModeRes] = await Promise.all([
        api.getDataStatus(),
        api.getAirplaneMode(),
      ])

      if (dataRes.data) setDataStatus(dataRes.data.active)
      if (airplaneModeRes.data) setAirplaneMode(airplaneModeRes.data)
      await checkHealth()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
    const interval = window.setInterval(() => {
      void checkHealth()
    }, 30000)
    return () => window.clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleTabChange = (_event: SyntheticEvent, value: number) => setTabValue(value)

  const toggleDataConnection = async () => {
    try {
      setError(null)
      setSuccess(null)
      const newStatus = !dataStatus
      await api.setDataStatus(newStatus)
      setDataStatus(newStatus)
      setSuccess(`数据连接已${newStatus ? '启用' : '禁用'}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const toggleAirplaneMode = async () => {
    const snapshot = airplaneMode
    const newEnabled = !snapshot?.enabled
    if (snapshot) {
      setAirplaneMode({ ...snapshot, enabled: newEnabled })
    }
    try {
      setError(null)
      setSuccess(null)
      setAirplaneSwitching(true)
      const response = await api.setAirplaneMode(newEnabled)
      if (response.data) {
        setAirplaneMode(response.data)
        setSuccess(`飞行模式已${response.data.enabled ? '开启' : '关闭'}`)
      }
    } catch (err) {
      if (snapshot) setAirplaneMode(snapshot)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setAirplaneSwitching(false)
    }
  }

  const confirmModeSwitch = async () => {
    if (!pendingMode) return
    setModeSwitching(true)
    setError(null)
    setSuccess(null)
    try {
      await api.setWorkMode(pendingMode)
      await refreshWorkMode()
      setSuccess(`工作模式已切换为${modeLabel(pendingMode)}`)
      setPendingMode(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setModeSwitching(false)
    }
  }

  const renderHealthBadge = () => {
    const healthOk = healthStatus?.status === 'ok'
    const healthKnown = Boolean(healthStatus)
    const statusLabel = healthKnown ? (healthOk ? '正常' : '异常') : '检查中'
    const lastChecked = healthStatus?.timestamp
      ? new Date(healthStatus.timestamp).toLocaleTimeString()
      : '未检查'

    return (
      <Tooltip title={healthLoading ? '正在刷新后端存活状态' : '点击刷新后端存活状态'}>
        <Box component="span" sx={{ display: 'inline-flex' }}>
          <ButtonBase
            aria-label="刷新后端服务健康状态"
            disabled={healthLoading}
            onClick={() => void checkHealth()}
            sx={(theme) => {
              const mainColor = healthOk
                ? theme.palette.success.main
                : healthKnown
                  ? theme.palette.error.main
                  : theme.palette.warning.main
              const bgColor = healthOk
                ? theme.palette.mode === 'light' ? 'rgba(46, 125, 50, 0.08)' : 'rgba(102, 187, 106, 0.16)'
                : healthKnown
                  ? theme.palette.mode === 'light' ? 'rgba(211, 47, 47, 0.08)' : 'rgba(244, 67, 54, 0.16)'
                  : theme.palette.mode === 'light' ? 'rgba(237, 108, 2, 0.08)' : 'rgba(255, 167, 38, 0.16)'
              const hoverBgColor = healthOk
                ? theme.palette.mode === 'light' ? 'rgba(46, 125, 50, 0.12)' : 'rgba(102, 187, 106, 0.22)'
                : healthKnown
                  ? theme.palette.mode === 'light' ? 'rgba(211, 47, 47, 0.12)' : 'rgba(244, 67, 54, 0.22)'
                  : theme.palette.mode === 'light' ? 'rgba(237, 108, 2, 0.12)' : 'rgba(255, 167, 38, 0.22)'

              return {
                alignItems: 'center',
                bgcolor: bgColor,
                border: '1px solid',
                borderColor: mainColor,
                borderRadius: 1,
                gap: 1,
                justifyContent: 'flex-start',
                minHeight: 48,
                minWidth: 146,
                px: 1.5,
                py: 0.75,
                textAlign: 'left',
                transition: 'background-color 150ms ease, border-color 150ms ease, box-shadow 150ms ease',
                '&:hover': {
                  bgcolor: hoverBgColor,
                  boxShadow: `0 0 0 1px ${mainColor}`,
                },
                '&.Mui-disabled': {
                  opacity: 0.82,
                },
              }
            }}
          >
            {healthLoading ? (
              <CircularProgress
                size={14}
                sx={{
                  color: healthOk ? 'success.main' : healthKnown ? 'error.main' : 'warning.main',
                  flex: '0 0 auto',
                }}
              />
            ) : (
              <Box
                sx={{
                  bgcolor: healthOk ? 'success.main' : healthKnown ? 'error.main' : 'warning.main',
                  borderRadius: '50%',
                  boxShadow: (theme) => `0 0 0 5px ${
                    healthOk
                      ? theme.palette.mode === 'light' ? 'rgba(46, 125, 50, 0.12)' : 'rgba(102, 187, 106, 0.18)'
                      : healthKnown
                        ? theme.palette.mode === 'light' ? 'rgba(211, 47, 47, 0.12)' : 'rgba(244, 67, 54, 0.18)'
                        : theme.palette.mode === 'light' ? 'rgba(237, 108, 2, 0.12)' : 'rgba(255, 167, 38, 0.18)'
                  }`,
                  flex: '0 0 auto',
                  height: 10,
                  width: 10,
                }}
              />
            )}
            <Box minWidth={0}>
              <Typography variant="caption" color="text.primary" fontWeight={700} lineHeight={1.35} display="block">
                后端服务: {statusLabel}
              </Typography>
              <Typography variant="caption" color="text.secondary" lineHeight={1.35} display="block">
                上次检查: {lastChecked}
              </Typography>
            </Box>
          </ButtonBase>
        </Box>
      </Tooltip>
    )
  }

  const renderModeOption = (targetMode: WorkMode) => {
    const selected = mode === targetMode
    const Icon = targetMode === 'esim' ? Memory : SimCard
    return (
      <Box
        role="button"
        tabIndex={0}
        onClick={() => {
          if (!modeSwitching && !selected) setPendingMode(targetMode)
        }}
        onKeyDown={(event) => {
          if ((event.key === 'Enter' || event.key === ' ') && !modeSwitching && !selected) {
            setPendingMode(targetMode)
          }
        }}
        sx={{
          position: 'relative',
          cursor: selected || modeSwitching ? 'default' : 'pointer',
          height: '100%',
          minHeight: 92,
          p: 1.5,
          borderRadius: 1,
          border: '1px solid',
          borderColor: selected ? 'primary.main' : 'divider',
          bgcolor: selected ? 'rgba(25, 118, 210, 0.06)' : 'background.paper',
          boxShadow: selected ? '0 0 0 1px rgba(25, 118, 210, 0.28) inset' : 'none',
          color: 'text.primary',
          transition: 'border-color 150ms ease, background-color 150ms ease, box-shadow 150ms ease, transform 150ms ease',
          '&:hover': selected || modeSwitching ? {} : {
            borderColor: 'primary.light',
            bgcolor: 'action.hover',
            transform: 'translateY(-1px)',
          },
        }}
      >
        <Box display="flex" alignItems="center" gap={1.25} mb={1}>
          <Icon color="primary" fontSize="small" />
          <Typography fontWeight={700}>{modeLabel(targetMode)}</Typography>
          <Box flexGrow={1} />
          {selected && <CheckCircle color="primary" fontSize="small" />}
        </Box>
        <Typography variant="body2" color="text.secondary">
          {targetMode === 'esim'
            ? '开放 eUICC Profile 管理能力，用于管理插入设备的实体 eSIM 卡。'
            : '隐藏 eSIM 管理模块，并阻止 eSIM Profile 管理接口。'}
        </Typography>
      </Box>
    )
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box>
      <Box
        mb={3}
        display="flex"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        gap={2}
        flexWrap="wrap"
      >
        <Box minWidth={0}>
          <Typography variant="h4" gutterBottom fontWeight={600}>
            系统配置
          </Typography>
          <Typography variant="body2" color="text.secondary">
            管理设备连接和其他系统参数
          </Typography>
        </Box>
        {renderHealthBadge()}
      </Box>

      <ErrorSnackbar error={error} onClose={() => setError(null)} />
      {success && (
        <Snackbar
          open
          autoHideDuration={3000}
          resumeHideDuration={3000}
          onClose={() => setSuccess(null)}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert severity="success" variant="filled" onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        </Snackbar>
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tabValue} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
          <Tab label="基本配置" />
          <Tab label="预留1" />
          <Tab label="预留2" />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        <Box display="flex" flexDirection="column" gap={3}>
          <Card>
            <CardHeader
              avatar={<SimCard color="primary" />}
              title="工作模式"
              titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
              action={
                <Chip
                  label={mode === 'esim' ? 'eSIM 已启用' : '普通 SIM 已启用'}
                  color="primary"
                  variant="outlined"
                  size="small"
                  sx={primaryStatusChipSx}
                />
              }
            />
            <CardContent>
              <Typography variant="body2" color="text.secondary" paragraph>
                工作模式只控制 eSIM 管理功能是否开放，不切换设备硬件。普通 SIM 模式下不会加载 eSIM 管理页面，也不会调用 lpac。
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  {renderModeOption('sim')}
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  {renderModeOption('esim')}
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <Grid container spacing={3} alignItems="stretch">
            <Grid size={{ xs: 12, md: 6 }} sx={{ display: 'flex' }}>
              <Card sx={{ width: 1, height: 1, display: 'flex', flexDirection: 'column' }}>
                <CardHeader
                  avatar={<Wifi color="primary" />}
                  title="数据连接配置"
                  titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
                  action={
                    <Chip
                      label={dataStatus ? '已启用' : '已禁用'}
                      color={dataStatus ? 'primary' : 'default'}
                      variant={dataStatus ? 'outlined' : undefined}
                      size="small"
                      sx={dataStatus ? primaryStatusChipSx : undefined}
                    />
                  }
                />
                <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="body2" color="text.secondary">
                    控制设备的数据连接状态。禁用后设备将断开移动网络连接。
                  </Typography>
                  <Divider sx={{ my: 2 }} />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={dataStatus}
                        onChange={() => void toggleDataConnection()}
                        color="primary"
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body1" fontWeight={600}>
                          {dataStatus ? '数据连接已启用' : '数据连接已禁用'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          立即{dataStatus ? '断开' : '启用'}移动数据连接
                        </Typography>
                      </Box>
                    }
                  />
                  <Alert
                    severity="info"
                    sx={{
                      ...compactCardAlertSx,
                      mt: controlFollowupGap,
                    }}
                  >
                    禁用数据连接将中断所有使用移动网络的应用和服务
                  </Alert>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }} sx={{ display: 'flex' }}>
              <Card sx={{ width: 1, height: 1, display: 'flex', flexDirection: 'column' }}>
                <CardHeader
                  avatar={<FlightTakeoff color={airplaneMode?.enabled ? 'warning' : 'primary'} />}
                  title="飞行模式"
                  titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
                  action={
                    <Chip
                      label={airplaneMode?.enabled ? '已开启' : '已关闭'}
                      color={airplaneMode?.enabled ? 'primary' : 'default'}
                      variant={airplaneMode?.enabled ? 'outlined' : undefined}
                      size="small"
                      sx={airplaneMode?.enabled ? primaryStatusChipSx : undefined}
                    />
                  }
                />
                <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="body2" color="text.secondary">
                    开启飞行模式将关闭射频，设备将无法连接移动网络。这不会影响本机 Web 管理访问。
                  </Typography>
                  <Divider sx={{ my: 2 }} />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={airplaneMode?.enabled || false}
                        onChange={() => void toggleAirplaneMode()}
                        disabled={airplaneSwitching}
                        color="warning"
                      />
                    }
                    label={
                      <Box display="flex" alignItems="center" gap={1}>
                        {airplaneSwitching && <CircularProgress size={16} />}
                        <Box>
                          <Typography variant="body1" fontWeight={600}>
                            {airplaneMode?.enabled ? '飞行模式已开启' : '飞行模式已关闭'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {airplaneMode?.enabled ? '射频已关闭，无法连接网络' : '射频正常工作'}
                          </Typography>
                        </Box>
                      </Box>
                    }
                  />
                  <Box mt={controlFollowupGap} mb={controlFollowupGap} p={2} sx={{ bgcolor: 'action.hover', borderRadius: 1 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      <strong>当前状态详情</strong>
                    </Typography>
                    <Box display="flex" gap={2} flexWrap="wrap">
                      <Chip
                        label={`Modem 电源: ${airplaneMode?.powered ? '开启' : '关闭'}`}
                        size="small"
                        color={airplaneMode?.powered ? 'success' : 'default'}
                        variant="outlined"
                      />
                      <Chip
                        label={`射频: ${airplaneMode?.online ? '在线' : '离线'}`}
                        size="small"
                        color={airplaneMode?.online ? 'success' : 'error'}
                        variant="outlined"
                      />
                    </Box>
                  </Box>
                  <Alert severity="warning" sx={compactCardAlertSx}>
                    飞行模式通过设置 Modem 的 Online 属性来控制射频。
                  </Alert>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <ReservedPanel title="预留1" />
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <ReservedPanel title="预留2" />
      </TabPanel>

      <Dialog open={!!pendingMode} onClose={() => !modeSwitching && setPendingMode(null)} maxWidth="sm" fullWidth>
        <DialogTitle>确认切换工作模式</DialogTitle>
        <DialogContent>
          <DialogContentText>
            确定要切换为{pendingMode ? modeLabel(pendingMode) : ''}吗？
          </DialogContentText>
          {pendingMode === 'sim' && (
            <Alert severity="info" sx={{ mt: 2 }}>
              切换后将隐藏 eSIM 管理模块，并阻止 eSIM Profile 管理接口。
            </Alert>
          )}
          {pendingMode === 'esim' && (
            <Alert severity="info" sx={{ mt: 2 }}>
              切换后将显示 eSIM 管理模块，打开页面或执行操作时才会按需调用 lpac。
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingMode(null)} disabled={modeSwitching}>取消</Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => void confirmModeSwitch()}
            disabled={modeSwitching}
            startIcon={modeSwitching ? <CircularProgress size={16} /> : undefined}
          >
            确认切换
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

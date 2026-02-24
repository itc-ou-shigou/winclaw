package ai.winclaw.android.node

import ai.winclaw.android.gateway.GatewaySession
import ai.winclaw.android.protocol.WinClawCanvasA2UICommand
import ai.winclaw.android.protocol.WinClawCanvasCommand
import ai.winclaw.android.protocol.WinClawCameraCommand
import ai.winclaw.android.protocol.WinClawLocationCommand
import ai.winclaw.android.protocol.WinClawScreenCommand
import ai.winclaw.android.protocol.WinClawSmsCommand

class InvokeDispatcher(
  private val canvas: CanvasController,
  private val cameraHandler: CameraHandler,
  private val locationHandler: LocationHandler,
  private val screenHandler: ScreenHandler,
  private val smsHandler: SmsHandler,
  private val a2uiHandler: A2UIHandler,
  private val debugHandler: DebugHandler,
  private val appUpdateHandler: AppUpdateHandler,
  private val isForeground: () -> Boolean,
  private val cameraEnabled: () -> Boolean,
  private val locationEnabled: () -> Boolean,
) {
  suspend fun handleInvoke(command: String, paramsJson: String?): GatewaySession.InvokeResult {
    // Check foreground requirement for canvas/camera/screen commands
    if (
      command.startsWith(WinClawCanvasCommand.NamespacePrefix) ||
        command.startsWith(WinClawCanvasA2UICommand.NamespacePrefix) ||
        command.startsWith(WinClawCameraCommand.NamespacePrefix) ||
        command.startsWith(WinClawScreenCommand.NamespacePrefix)
    ) {
      if (!isForeground()) {
        return GatewaySession.InvokeResult.error(
          code = "NODE_BACKGROUND_UNAVAILABLE",
          message = "NODE_BACKGROUND_UNAVAILABLE: canvas/camera/screen commands require foreground",
        )
      }
    }

    // Check camera enabled
    if (command.startsWith(WinClawCameraCommand.NamespacePrefix) && !cameraEnabled()) {
      return GatewaySession.InvokeResult.error(
        code = "CAMERA_DISABLED",
        message = "CAMERA_DISABLED: enable Camera in Settings",
      )
    }

    // Check location enabled
    if (command.startsWith(WinClawLocationCommand.NamespacePrefix) && !locationEnabled()) {
      return GatewaySession.InvokeResult.error(
        code = "LOCATION_DISABLED",
        message = "LOCATION_DISABLED: enable Location in Settings",
      )
    }

    return when (command) {
      // Canvas commands
      WinClawCanvasCommand.Present.rawValue -> {
        val url = CanvasController.parseNavigateUrl(paramsJson)
        canvas.navigate(url)
        GatewaySession.InvokeResult.ok(null)
      }
      WinClawCanvasCommand.Hide.rawValue -> GatewaySession.InvokeResult.ok(null)
      WinClawCanvasCommand.Navigate.rawValue -> {
        val url = CanvasController.parseNavigateUrl(paramsJson)
        canvas.navigate(url)
        GatewaySession.InvokeResult.ok(null)
      }
      WinClawCanvasCommand.Eval.rawValue -> {
        val js =
          CanvasController.parseEvalJs(paramsJson)
            ?: return GatewaySession.InvokeResult.error(
              code = "INVALID_REQUEST",
              message = "INVALID_REQUEST: javaScript required",
            )
        val result =
          try {
            canvas.eval(js)
          } catch (err: Throwable) {
            return GatewaySession.InvokeResult.error(
              code = "NODE_BACKGROUND_UNAVAILABLE",
              message = "NODE_BACKGROUND_UNAVAILABLE: canvas unavailable",
            )
          }
        GatewaySession.InvokeResult.ok("""{"result":${result.toJsonString()}}""")
      }
      WinClawCanvasCommand.Snapshot.rawValue -> {
        val snapshotParams = CanvasController.parseSnapshotParams(paramsJson)
        val base64 =
          try {
            canvas.snapshotBase64(
              format = snapshotParams.format,
              quality = snapshotParams.quality,
              maxWidth = snapshotParams.maxWidth,
            )
          } catch (err: Throwable) {
            return GatewaySession.InvokeResult.error(
              code = "NODE_BACKGROUND_UNAVAILABLE",
              message = "NODE_BACKGROUND_UNAVAILABLE: canvas unavailable",
            )
          }
        GatewaySession.InvokeResult.ok("""{"format":"${snapshotParams.format.rawValue}","base64":"$base64"}""")
      }

      // A2UI commands
      WinClawCanvasA2UICommand.Reset.rawValue -> {
        val a2uiUrl = a2uiHandler.resolveA2uiHostUrl()
          ?: return GatewaySession.InvokeResult.error(
            code = "A2UI_HOST_NOT_CONFIGURED",
            message = "A2UI_HOST_NOT_CONFIGURED: gateway did not advertise canvas host",
          )
        val ready = a2uiHandler.ensureA2uiReady(a2uiUrl)
        if (!ready) {
          return GatewaySession.InvokeResult.error(
            code = "A2UI_HOST_UNAVAILABLE",
            message = "A2UI host not reachable",
          )
        }
        val res = canvas.eval(A2UIHandler.a2uiResetJS)
        GatewaySession.InvokeResult.ok(res)
      }
      WinClawCanvasA2UICommand.Push.rawValue, WinClawCanvasA2UICommand.PushJSONL.rawValue -> {
        val messages =
          try {
            a2uiHandler.decodeA2uiMessages(command, paramsJson)
          } catch (err: Throwable) {
            return GatewaySession.InvokeResult.error(
              code = "INVALID_REQUEST",
              message = err.message ?: "invalid A2UI payload"
            )
          }
        val a2uiUrl = a2uiHandler.resolveA2uiHostUrl()
          ?: return GatewaySession.InvokeResult.error(
            code = "A2UI_HOST_NOT_CONFIGURED",
            message = "A2UI_HOST_NOT_CONFIGURED: gateway did not advertise canvas host",
          )
        val ready = a2uiHandler.ensureA2uiReady(a2uiUrl)
        if (!ready) {
          return GatewaySession.InvokeResult.error(
            code = "A2UI_HOST_UNAVAILABLE",
            message = "A2UI host not reachable",
          )
        }
        val js = A2UIHandler.a2uiApplyMessagesJS(messages)
        val res = canvas.eval(js)
        GatewaySession.InvokeResult.ok(res)
      }

      // Camera commands
      WinClawCameraCommand.Snap.rawValue -> cameraHandler.handleSnap(paramsJson)
      WinClawCameraCommand.Clip.rawValue -> cameraHandler.handleClip(paramsJson)

      // Location command
      WinClawLocationCommand.Get.rawValue -> locationHandler.handleLocationGet(paramsJson)

      // Screen command
      WinClawScreenCommand.Record.rawValue -> screenHandler.handleScreenRecord(paramsJson)

      // SMS command
      WinClawSmsCommand.Send.rawValue -> smsHandler.handleSmsSend(paramsJson)

      // Debug commands
      "debug.ed25519" -> debugHandler.handleEd25519()
      "debug.logs" -> debugHandler.handleLogs()

      // App update
      "app.update" -> appUpdateHandler.handleUpdate(paramsJson)

      else ->
        GatewaySession.InvokeResult.error(
          code = "INVALID_REQUEST",
          message = "INVALID_REQUEST: unknown command",
        )
    }
  }
}

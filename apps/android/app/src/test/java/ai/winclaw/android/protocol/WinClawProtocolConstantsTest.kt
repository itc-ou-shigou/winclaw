package ai.winclaw.android.protocol

import org.junit.Assert.assertEquals
import org.junit.Test

class WinClawProtocolConstantsTest {
  @Test
  fun canvasCommandsUseStableStrings() {
    assertEquals("canvas.present", WinClawCanvasCommand.Present.rawValue)
    assertEquals("canvas.hide", WinClawCanvasCommand.Hide.rawValue)
    assertEquals("canvas.navigate", WinClawCanvasCommand.Navigate.rawValue)
    assertEquals("canvas.eval", WinClawCanvasCommand.Eval.rawValue)
    assertEquals("canvas.snapshot", WinClawCanvasCommand.Snapshot.rawValue)
  }

  @Test
  fun a2uiCommandsUseStableStrings() {
    assertEquals("canvas.a2ui.push", WinClawCanvasA2UICommand.Push.rawValue)
    assertEquals("canvas.a2ui.pushJSONL", WinClawCanvasA2UICommand.PushJSONL.rawValue)
    assertEquals("canvas.a2ui.reset", WinClawCanvasA2UICommand.Reset.rawValue)
  }

  @Test
  fun capabilitiesUseStableStrings() {
    assertEquals("canvas", WinClawCapability.Canvas.rawValue)
    assertEquals("camera", WinClawCapability.Camera.rawValue)
    assertEquals("screen", WinClawCapability.Screen.rawValue)
    assertEquals("voiceWake", WinClawCapability.VoiceWake.rawValue)
  }

  @Test
  fun screenCommandsUseStableStrings() {
    assertEquals("screen.record", WinClawScreenCommand.Record.rawValue)
  }
}

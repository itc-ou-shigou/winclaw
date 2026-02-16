package ai.winclaw.android.ui

import androidx.compose.runtime.Composable
import ai.winclaw.android.MainViewModel
import ai.winclaw.android.ui.chat.ChatSheetContent

@Composable
fun ChatSheet(viewModel: MainViewModel) {
  ChatSheetContent(viewModel = viewModel)
}

use windows::core::{w, PCWSTR, PWSTR};
use windows::Win32::System::Com::{CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED};
use windows::Win32::UI::Controls::Dialogs::{
    CommDlgExtendedError, GetOpenFileNameW, OFN_ALLOWMULTISELECT, OFN_DONTADDTORECENT,
    OFN_EXPLORER, OFN_FILEMUSTEXIST, OFN_NOCHANGEDIR, OFN_PATHMUSTEXIST, OPENFILENAMEW,
};

use crate::music_queue::parse_selection;

pub fn select_files() -> Result<Vec<String>, String> {
    unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED).ok() }
        .map_err(|error| error.to_string())?;
    let result = show_dialog();
    unsafe { CoUninitialize() };
    result
}

fn show_dialog() -> Result<Vec<String>, String> {
    let filter: Vec<u16> =
        "Music files\0*.mp3;*.mpeg;*.flac;*.wav;*.m4a;*.aac;*.wma;*.ogg;*.opus\0All files\0*.*\0\0"
            .encode_utf16()
            .collect();
    let mut buffer = vec![0_u16; 65_536];
    let mut dialog = OPENFILENAMEW {
        lStructSize: std::mem::size_of::<OPENFILENAMEW>() as u32,
        lpstrFilter: PCWSTR(filter.as_ptr()),
        lpstrFile: PWSTR(buffer.as_mut_ptr()),
        nMaxFile: buffer.len() as u32,
        lpstrTitle: w!("Open music — winx-island"),
        Flags: OFN_ALLOWMULTISELECT
            | OFN_EXPLORER
            | OFN_FILEMUSTEXIST
            | OFN_PATHMUSTEXIST
            | OFN_NOCHANGEDIR
            | OFN_DONTADDTORECENT,
        ..Default::default()
    };
    if unsafe { GetOpenFileNameW(&mut dialog).as_bool() } {
        return Ok(parse_selection(&buffer));
    }
    let error = unsafe { CommDlgExtendedError() }.0;
    if error == 0 {
        Ok(vec![])
    } else {
        crate::logger::log(format!("music picker failed (Windows error {error})"));
        Err("error.picker_failed".into())
    }
}

pub fn select_folders() -> Result<Vec<std::path::PathBuf>, String> {
    unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED).ok() }
        .map_err(|error| error.to_string())?;
    let result = show_folder_dialog().map_err(|error| error.to_string());
    unsafe { CoUninitialize() };
    result
}

fn show_folder_dialog() -> windows::core::Result<Vec<std::path::PathBuf>> {
    use windows::core::HRESULT;
    use windows::Win32::Foundation::ERROR_CANCELLED;
    use windows::Win32::System::Com::{CoCreateInstance, CoTaskMemFree, CLSCTX_INPROC_SERVER};
    use windows::Win32::UI::Shell::{
        FileOpenDialog, IFileOpenDialog, FOS_ALLOWMULTISELECT, FOS_DONTADDTORECENT,
        FOS_FORCEFILESYSTEM, FOS_NOCHANGEDIR, FOS_PICKFOLDERS, SIGDN_FILESYSPATH,
    };

    unsafe {
        let dialog: IFileOpenDialog =
            CoCreateInstance(&FileOpenDialog, None, CLSCTX_INPROC_SERVER)?;
        dialog.SetOptions(
            dialog.GetOptions()?
                | FOS_PICKFOLDERS
                | FOS_ALLOWMULTISELECT
                | FOS_FORCEFILESYSTEM
                | FOS_DONTADDTORECENT
                | FOS_NOCHANGEDIR,
        )?;
        dialog.SetTitle(w!("Add music folders — winx-island"))?;
        if let Err(error) = dialog.Show(None) {
            if error.code() == HRESULT::from_win32(ERROR_CANCELLED.0) {
                return Ok(vec![]);
            }
            return Err(error);
        }
        let selected = dialog.GetResults()?;
        let mut folders = Vec::new();
        for index in 0..selected.GetCount()? {
            let item = selected.GetItemAt(index)?;
            let pointer = item.GetDisplayName(SIGDN_FILESYSPATH)?;
            let path = pointer.to_string();
            CoTaskMemFree(Some(pointer.0.cast()));
            folders.push(std::path::PathBuf::from(path?));
        }
        Ok(folders)
    }
}

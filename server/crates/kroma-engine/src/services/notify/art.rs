//! The image a PUSH carries.
//!
//! A push does not carry the picture, only where to find it: Web Push hands the
//! service worker a URL, APNs hands a Notification Service Extension one, and
//! FCM hands Android's own downloader one. All three fetch it AFTER delivery, on
//! the device's own network, and all three are capped at about four kilobytes of
//! payload - which is why the bytes themselves can never ride along.
//!
//! So the one thing worth deciding here is WHICH rendition to name. The master
//! is up to 1280 px wide; a lock-screen thumbnail is a fraction of that, and a
//! phone on mobile data pays for every byte of the difference.

use kroma_domain::Notification;

use crate::infra::image::PUBLIC_PREFIX;

/// Rendition width a push should ask for. Wide enough for Android's big-picture
/// style and an iOS attachment, far below the stored master. Must be one of the
/// buckets `GET /api/images/:name?w=` accepts, or the server ignores it.
const PUSH_WIDTH: u32 = 780;

/// Point `image_url` at a sized rendition, when it is one of ours.
///
/// External art (a TMDB poster) is left alone - it is already sized by whoever
/// serves it, and appending our query would only break their cache key.
pub fn sized_for_push(mut n: Notification) -> Notification {
    n.image_url = n.image_url.map(|url| {
        if url.starts_with(PUBLIC_PREFIX) && !url.contains('?') {
            format!("{url}?w={PUSH_WIDTH}")
        } else {
            url
        }
    });
    n
}

#[cfg(test)]
mod tests {
    use super::*;
    use kroma_domain::{NotificationCategory, NotificationEvent};

    fn with_image(url: Option<&str>) -> Notification {
        Notification {
            id: "n1".into(),
            category: NotificationCategory::Media,
            event: NotificationEvent::MediaAdded,
            title: "t".into(),
            body: "b".into(),
            link: None,
            image_url: url.map(str::to_string),
            actions: Vec::new(),
            push_category: None,
            read: false,
            created_at: 0,
        }
    }

    #[test]
    fn our_own_art_is_asked_for_at_a_push_size() {
        let out = sized_for_push(with_image(Some("/api/images/abc.webp")));
        assert_eq!(out.image_url.as_deref(), Some("/api/images/abc.webp?w=780"));
    }

    #[test]
    fn someone_elses_art_and_an_already_sized_one_are_left_alone() {
        // A TMDB poster is already sized by whoever serves it; our query string
        // would only break their cache key.
        let external = "https://image.tmdb.org/t/p/w500/x.jpg";
        assert_eq!(sized_for_push(with_image(Some(external))).image_url.as_deref(), Some(external));

        let sized = "/api/images/abc.webp?w=320";
        assert_eq!(sized_for_push(with_image(Some(sized))).image_url.as_deref(), Some(sized));

        assert!(sized_for_push(with_image(None)).image_url.is_none());
    }
}

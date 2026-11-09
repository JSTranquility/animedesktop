# Contributing

Start with `npm test`. Keep widgets, services and themes modular. Use native final allocations for text/icons/images; do not scale a painted root actor. Clean up timers, D-Bus subscriptions and actors on disable and shutdown.

Calendar tests cover date boundaries; D-Bus fixture tests require GJS/Soup; GNOME rendering tests require Shell 51. State which checks actually ran. A passing portable CI job does not establish physical HDMI/GPU compatibility.

New integrations must be opt-in and reversible. Back up affected files before mutation. Keep runtime state, absolute personal paths and downloaded art out of Git. Run `scripts/audit-publication.py` after staging changes; it inspects staged blobs rather than only the working tree.

Update compatibility only after testing the new Shell version. Do not bypass extension version checks or Shell security mechanisms. Use original/licensed demo assets for screenshots and document external asset sources separately.

Code contributions use the MIT license in this repository. Submit a concise problem/behavior description and relevant validation in the PR.

# Polyhedron Gender Test

This is a script-free diagnostic mod. It tests the game's built-in localization
resolver; it does not show a popup and does not require Script Extender.

## Structure

- `Mods/PolyhedronGenderTest/meta.lsx` — mod metadata
- `Localization/English/english.xml` — Default/fallback entries
- `Localization/English/english_to_F.xml` — Female addressee entries

Use the generated `mods/PolyhedronGenderTest.pak` in BG3 Mod Manager and
restart the game. The folder beside it is the unpacked source used to rebuild
the PAK.

The PAK currently contains the two test strings for `Us` and Lae'zel. The same
`contentuid` exists in both XML files with different text. If the game knows
that the line is addressed to a female
character, it should display `english_to_F.xml`; otherwise it will display the
Default value from `english.xml`.

This test deliberately does not include `Gender/Female`: that folder controls
the speaker's identity, while `_to_F` controls the addressee's identity.

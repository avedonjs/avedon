# @avedon/compiler

Parses `.avedon` files and emits separate client and server modules. Server `<script server>` content is physically excluded from the client codegen path (verified by leak tests).

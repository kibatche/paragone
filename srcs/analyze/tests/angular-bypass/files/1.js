// positif : Angular
this.sanitizer.bypassSecurityTrustHtml(route.snapshot.queryParams.html);
this.sanitizer.bypassSecurityTrustResourceUrl(url);
// positif : AngularJS, forme simple
$sce.trustAsHtml($location.search().msg);
// positif : AngularJS, forme typée : la valeur est le second argument
$sce.trustAs($sce.HTML, value);
// négatif : sanitize ne contourne rien
this.sanitizer.sanitize(1, value);
// négatif : parseAsync (zod) n'est pas parseAs
schema.parseAsync(input, ctx);
// positif : contexte MEDIA_URL
$sce.trustAsMediaUrl(src);

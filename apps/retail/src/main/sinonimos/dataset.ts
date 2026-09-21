import { parsearCsvSinonimos } from './csv';

// ADR-067 — Dataset base de sinónimos de ferretería (aprobado por el owner 2026-08-17).
//
// Se embebe el CSV aprobado COMO TEXTO y se parsea en carga (inline en TS, sin
// extraResources, como pide el ADR). El contenido es idéntico al CSV entregado. Estructura
// por grupo: `canonico` + `sinonimos` (regionalismos, coloquiales, técnicos, inglés,
// errores de tipeo) + `abreviaturas` (SOLO-ENTRADA: disparan la expansión al tipearlas pero
// nunca se usan como patrón de substring). `nota` documenta ambigüedades. Los acentos NO
// importan para el match (se compara normalizado); se conservan sólo para mostrar.
//
// Columnas: canonico,sinonimos,abreviaturas,rubro,nota  — listas separadas por "|".

export type SinonimoGrupo = {
  canonico: string;
  sinonimos: string[];
  abreviaturas?: string[];
  rubro?: string;
  nota?: string;
};

const DATASET_CSV = `canonico,sinonimos,abreviaturas,rubro,nota
alicate,pinza|tenaza|alicate universal|pliers|alicante,alic.|alic,Herramientas manuales,"En AR ""pinza"" suele = alicate; ambiguo con pinza de electricista"
alicate de corte,pinza de corte|corta alambre|corta cable|cortante|diagonal|side cutter,,Herramientas manuales,
alicate pico de loro,pico de loro|pico loro|pinza pico de loro|pinza multiuso|water pump|pico e loro,,Herramientas manuales,
destornillador,atornillador|desarmador|destornillado|tornillador|screwdriver|destorbillador,dest.|dest|destorn.,Herramientas manuales,Errores de tipeo frecuentes
destornillador plano,destornillador paleta|paleta|plano|slotted|flat|pala,dest. plano,Herramientas manuales,
destornillador phillips,destornillador cruz|cruz|estria|estrella|phillips|philips|filips,dest. phillips|dest. cruz,Herramientas manuales,Marca Phillips usada como genérico
martillo,maceta|hammer|martiyo|martilo,mart.,Herramientas manuales,"Maceta = martillo de albañil; ambiguo"
maza,mazo|masa|almadena|sledge|maceta grande,,Herramientas manuales,
llave inglesa,llave ajustable|llave francesa|llave regulable|crescent|inglesa|llabe inglesa,ll. inglesa|ll inglesa,Herramientas manuales,
llave stilson,llave de caño|llave para caño|llave cania|pipe wrench|stillson|estilson,ll. stilson,Plomería,
llave fija,llave boca|llave española|boca fija|open end,ll. fija,Herramientas manuales,
llave combinada,llave corona|corona|llave estrella|combination,ll. comb.,Herramientas manuales,
llave tubo,llave de tubo|tubo|socket|dado|copa,ll. tubo,Herramientas manuales,
llave allen,llave hexagonal|hexagonal|allen|bristol|hex key|llave bristol|alen,ll. allen,Herramientas manuales,
serrucho,sierra de mano|sierra manual|serucho|saw,serr.,Herramientas manuales,
sierra,serrucho|hoja de sierra|arco de sierra|saw,,Herramientas manuales,
formon,escoplo|formón|chisel|formon de madera,form.,Herramientas manuales,
cincel,cortafierro|cortafrio|cortahierro|cortafrío|chisel|sincel,,Herramientas manuales,
lima,escofina|file|lima plana|lima redonda,,Herramientas manuales,Escofina = lima gruesa para madera
morsa,prensa de banco|tornillo de banco|bench vise|morza|torno de banco,,Herramientas manuales,
prensa,sargento|grampa|clamp|gato de carpintero,,Herramientas manuales,Ambiguo: sargento/morsa/prensa hidráulica
sargento,prensa sargento|grampa f|clamp|gancho|sargento f,,Herramientas manuales,
cinta metrica,metro|flexometro|flexómetro|huincha|centimetro|tape measure|cinta métrica,,Herramientas manuales,
nivel,nivel de burbuja|nivel de mano|level|nibel,,Herramientas manuales,
escuadra,cartabon|cartabón|square|escuadra de carpintero,escuad.,Herramientas manuales,
plomada,plomo de albañil|plumb bob|plomada de punta,,Herramientas manuales,
espatula,espátula|scraper|putty knife|espatula pintor,esp.,Pintura,
llana,fratacho|fratás|talocha|trowel|yana,,Herramientas manuales,Fratacho = llana de madera/plástico
cuchara,cuchara de albañil|paleta de albañil|trowel|cuchara albañil,,Herramientas manuales,
maceta de goma,mazo de goma|martillo de goma|rubber mallet,,Herramientas manuales,
pala,pala punta|pala ancha|shovel|pala de puntear,,Herramientas manuales,
pico,zapapico|pickaxe|piqueta,,Herramientas manuales,
carretilla,carretiya|wheelbarrow|carretilla de obra,carret.,Herramientas manuales,
taladro,taladradora|drill|taladro percutor|perforadora,tal.,Herramientas eléctricas,
amoladora,esmeril angular|esmeril|galletera|grinder|moladora|amoladora angular,amol.,Herramientas eléctricas,Galletera = regionalismo
mecha,broca|mecha de taladro|drill bit|mecha|broca de taladro,mch.,Herramientas eléctricas,"En AR ""mecha"" = broca"
broca,mecha|drill bit|broca de taladro,,Herramientas eléctricas,
atornillador electrico,atornillador inalámbrico|destornillador eléctrico|screwdriver|atornillador a batería,atorn.,Herramientas eléctricas,
sierra caladora,caladora|jigsaw|sierra de calar,,Herramientas eléctricas,
sierra circular,circular|circular saw|sierra de mano eléctrica,,Herramientas eléctricas,
lijadora,lijadora orbital|sander|lija eléctrica,lij.,Herramientas eléctricas,
soldadora,maquina de soldar|máquina de soldar|welder|soldadora eléctrica,sold.,Herramientas eléctricas,
pistola de calor,soplete de calor|heat gun|decapadora,,Herramientas eléctricas,
disco de corte,disco amoladora|disco de amoladora|cutting disc|disco corte|disco fino,disco cte.,Abrasivos,
disco de desbaste,disco desbaste|grinding disc|disco grueso,,Abrasivos,
disco flap,disco laminado|flap disc|disco de solapa,,Abrasivos,
lija,papel de lija|sandpaper|hoja de lija|lija al agua,,Abrasivos,
tornillo,screw|torniyo|tornilllo,torn.|torn|tor.,Fijaciones,
tornillo autoperforante,autoperforante|autorroscante|self drilling|autoperforate|tornillo t1|t1,torn. autop.|autop.,Fijaciones,
tornillo para madera,tornillo madera|wood screw|tirafondo,torn. madera,Fijaciones,
bulon,perno|bolt|bulón|buloncito|tornillo con tuerca,bul.|bul,Fijaciones,
perno,bulon|esparrago|espárrago|stud|bolt,,Fijaciones,
tuerca,nut|tuerka|tuerca hexagonal,tca.|tuer.,Fijaciones,
tuerca mariposa,mariposa|wing nut|tuerca de mariposa,,Fijaciones,
arandela,volandera|golilla|washer|arandela plana|arandela de presión,aran.|ar.,Fijaciones,
tarugo,taco|fischer|fisher|ramplug|mota|taruguito|wall plug|anclaje plástico|taco fischer,tar.,Fijaciones,Marca Fischer usada como genérico
clavo,puntilla|nail|clabo|clavos,cl.,Fijaciones,
remache,pop|rivet|remache pop|ribete,rem.,Fijaciones,
grampa,grapa|staple|gancho|grampa de acero,,Fijaciones,Ambiguo con grampa de abrazadera
alcayata,escarpia|gancho l|hook|escarpia l,,Fijaciones,
armella,cancamo|cáncamo|eye bolt|hembra|armella cerrada,,Fijaciones,
abrazadera,brida|zuncho|grampa|clamp|abrazadera metálica,abraz.,Fijaciones,
precinto,brida|cincho|amarre|atadura|zip tie|cable tie|precinto plástico,prec.,Fijaciones,"""Brida"" también es abrazadera; ambiguo"
esparrago,espárrago|varilla roscada|stud|barra roscada,esp.,Fijaciones,
varilla roscada,barra roscada|espárrago largo|threaded rod|varilla rosca,var. roscada,Fijaciones,
tirafondo,tornillo tirafondo|lag screw|tornillo grande,tiraf.,Fijaciones,
caño,tubo|cañeria|cañería|pipe|cano|cañito,ca.,Plomería,
codo,curva|elbow|codo 90|codo 45,,Plomería,
cupla,union|manguito|coupling|cupla lisa|acople,,Plomería,
niple,nipple|conector macho|niple roscado,,Plomería,
tee,te|ramal t|tee sanitaria|conexión t,,Plomería,
reduccion,reducción|reductor|adaptador|reducer|buje reductor,reduc.,Plomería,
llave de paso,valvula esferica|válvula esférica|esferica|llave de corte|valvula de paso|llave paso,ll. de paso,Plomería,
canilla,grifo|robinete|llave de agua|tap|faucet|caniya|griferia,can.,Plomería,"En AR ""canilla"" = grifo"
griferia,grifería|grifo|canilla|mezcladora|faucet,grif.,Plomería,
flexible,conexion flexible|conexión flexible|tubo flexible|hose|flexible de agua|mariposa,flex.,Plomería,
teflon,teflón|cinta de teflon|cinta selladora|ptfe|cinta plomero|cinta teflon,,Plomería,
sopapa,válvula de bacha|desagote|tapón sopapa|valvula pileta,,Plomería,
rejilla,reja de piso|rejilla de piso|drain|sifón de piso,,Plomería,
flotante,boya|válvula flotante|float|boya de tanque,,Plomería,
mochila,deposito|depósito|cisterna|tanque de inodoro|mochila inodoro,,Plomería,
inodoro,retrete|váter|water|toilet|excusado,inod.,Plomería,
sifon,sifón|trampa|codo sifón|trap,,Plomería,
membrana,cuerito|arandela de canilla|junta|washer|cuerito de canilla,,Plomería,"""Cuerito"" = regionalismo AR"
rosca,hilo|thread|rosca macho|rosca hembra,,Plomería,
cable,conductor|wire|cablecito|cable eléctrico|cavle,cbl.|cab.,Electricidad,
cable unipolar,unipolar|cable simple|single core,cable unip.,Electricidad,
ficha,enchufe macho|toma macho|plug|ficha macho,,Electricidad,"""Enchufe"" es ambiguo (macho/hembra)"
tomacorriente,toma|enchufe hembra|zócalo|receptáculo|outlet|toma corriente,toma,Electricidad,
enchufe,ficha|tomacorriente|plug|enchufe,,Electricidad,Ambiguo: macho (ficha) o hembra (toma)
llave de luz,interruptor|tecla|switch|apagador|llave de punto|tecla de luz,ll. de luz,Electricidad,
termica,térmica|llave térmica|interruptor termomagnético|breaker|termica|disyuntor térmico,term.,Electricidad,"No confundir térmica con disyuntor diferencial"
disyuntor,interruptor diferencial|diferencial|rcd|id|disyuntor diferencial,disy.,Electricidad,
portalampara,portalámpara|casquillo|boquilla|socket|rosca|portalampara,portalamp.,Electricidad,
lampara,lámpara|foco|bombilla|bombita|ampolleta|luz|bulb|lampara led|foquito,lamp.|lamp,Electricidad,Muchos regionalismos
tubo fluorescente,fluorescente|tubo|tube|tubo led|tubo de luz,,Electricidad,
cinta aisladora,cinta aislante|cinta de electricista|insulating tape|cinta aisladora|tape,,Electricidad,
prensacable,prensaestopa|cable gland|prensa cable,,Electricidad,
caja de luz,caja rectangular|caja octogonal|caja de embutir|box|cajita,,Electricidad,
cablecanal,canaleta|cable canal|zócalo canal|trunking|canal de cable,,Electricidad,
corrugado,caño corrugado|conduit|corrugado eléctrico|caño flexible,corr.,Electricidad,
zapatilla,prolongador|multiple|zapatilla eléctrica|power strip|triple,zap.,Electricidad,
prolongador,alargue|extension|zapatilla|extension cord|alargador,prolong.,Electricidad,
pincel,brocha|brush|pincel de cerda|pinsel,pinc.,Pintura,Brocha = pincel ancho
brocha,pincel ancho|brush|brocha de cerda,,Pintura,
rodillo,roller|rodillo de lana|rodiyo|rodillo pintura,rod.,Pintura,
latex,látex|pintura al agua|acrílico|latex interior|pintura latex,,Pintura,
esmalte,esmalte sintetico|sintético|enamel|esmalte al agua|esmalte,esm.,Pintura,
fondo,base|imprimacion|imprimación|primer|sellador|fondo blanco,,Pintura,
antioxido,antióxido|convertidor de óxido|fondo antioxido|rust converter|antioxidante,antiox.,Pintura,
diluyente,aguarras|aguarrás|thinner|solvente|diluir|dilullente,dil.,Pintura,
masilla,enduido|plaste|filler|masilla plástica|enduído,mas.,Pintura,Enduido = masilla para pared
enduido,masilla|enlucido|filler|enduído|enduido plástico,end.,Pintura,
bandeja,batea|cubeta|tray|bandeja de pintura|bandeja rodillo,,Pintura,
cinta de papel,cinta de enmascarar|cinta crepe|masking tape|cinta papel|cinta pintor,,Pintura,
barniz,laca|varnish|barniz marino|lasur,barn.,Pintura,
pintura en aerosol,aerosol|spray|pintura spray|aerosol pintura,,Pintura,
candado,padlock|candado de seguridad|candao,cand.,Cerrajería,
cerradura,cerrojo|lock|cerradura de embutir|serradura,cerr.,Cerrajería,
pestillo,pasador|cerrojo|latch|bolt|pestiyo,,Cerrajería,
bisagra,gozne|hinge|visagra|bisagra de libro,bis.,Cerrajería,
pomo,perilla|knob|pomo de puerta|manija redonda,,Cerrajería,
manija,manivela|handle|tirador|picaporte|maniya,man.,Cerrajería,
picaporte,manija|falleba|handle|picaporte doble balancín,picap.,Cerrajería,
cerrojo,pasador|pestillo|cerradura|deadbolt,,Cerrajería,
cadena,chain|cadena galvanizada|cadena de eslabones,,Cerrajería,
adhesivo,pegamento|cola|glue|cemento|pega|adesivo,adh.,Adhesivos,
cola vinilica,cola vinílica|cola de carpintero|adhesivo vinílico|white glue|cola blanca|cola,,Adhesivos,
cemento de contacto,cascola|adhesivo de contacto|contact cement|cemento contacto,,Adhesivos,Cascola = marca usada como genérico
silicona,sellador siliconado|sellador|sealant|silicona neutra|siliconar,sil.,Adhesivos,
adhesivo instantaneo,la gotita|cianoacrilato|super glue|pegamento instantáneo|gotita,,Adhesivos,La Gotita = marca usada como genérico
masilla epoxi,poxipol|epoxi|adhesivo epoxi|poximix|masilla epóxica,,Adhesivos,Poxipol = marca usada como genérico
espuma de poliuretano,espuma expandible|espuma pu|foam|espuma de montaje,,Adhesivos,
sellador,sellador acrílico|masilla selladora|sealant|sellador de juntas,sell.,Adhesivos,
placa de yeso,durlock|panel de yeso|drywall|placa yeso|roca de yeso|yeso,,Construcción en seco,Durlock = marca usada como genérico
perfil montante,montante|perfil galvanizado|stud|perfil durlock,,Construcción en seco,
malla,tela metalica|tejido|mesh|malla galvanizada|tela mosquitera,,Construcción,
alambre,wire|alambre galvanizado|alambre de fardo|alanbre,alamb.,Construcción,
rodamiento,ruleman|cojinete|bearing|rulemán|balero,rulem.,Repuestos,Ruleman = regionalismo AR
correa,corea|belt|correa trapezoidal|banda,,Repuestos,
resorte,muelle|spring|resorte de compresión|espiral,,Repuestos,
oring,o-ring|junta tórica|arandela de goma|reten,,Repuestos,
guante,guantes|gloves|guante de trabajo|guante moteado,,Seguridad,
antiparra,antiparras|lentes de seguridad|gafas|goggles|protección ocular,,Seguridad,
barbijo,mascarilla|tapaboca|respirador|mask|barbijo n95,,Seguridad,
casco,casco de obra|helmet|casco de seguridad,,Seguridad,
Philips,,phil.|phil|fil|philis,Marca,El match también va contra la marca del producto
Stanley,,stan.|stanle,Marca,
Tramontina,,tramont.|tram.|tramo,Marca,
Bosch,bosh,bos.,Marca,
Plavicon,,plavi.|plavi,Marca,
Ferrum,,ferr.,Marca,
Sica,sika,,Marca,
Fischer,fisher,fisch.,Marca,También genérico de tarugo`;

export const SINONIMO_GRUPOS: SinonimoGrupo[] = parsearCsvSinonimos(DATASET_CSV).grupos;

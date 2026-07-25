# Explicación del Módulo Plantillas de E-mail

> Documento no técnico para ajustar y entender el módulo de **Plantillas de E-mail** dentro de **Gestiones**.

---

## 1. ¿Qué es una plantilla de e-mail?

Una **plantilla de e-mail** es un mensaje prearmado que se puede usar una y otra vez para enviar correos dentro del sistema. Funciona como un borrador inteligente: tiene un **asunto** y un **cuerpo de mensaje**, y en esos textos se colocan **marcadores** que el sistema reemplaza automáticamente por datos reales del siniestro, de la gestión o de la persona.

Es lo mismo que ya hacemos hoy con las plantillas de documentos Word: se crea un modelo, se le ponen campos que se completan solos, y se obtiene un documento o, en este caso, un e-mail listo para enviar.

---

## 2. ¿Dónde vive este módulo?

El módulo se encuentra dentro del menú de **Catálogos → Gestiones**, junto a las pantallas de Tipos de Gestión, Características, Workflows, etc. Allí se crean, editan y activan las plantillas de e-mail.

---

## 3. ¿Cómo se crea una plantilla de e-mail?

Al crear una plantilla se le indica:

- **Nombre interno**: para identificarla dentro del sistema (por ejemplo, "Aviso de asignación — Comercial").
- **Línea de negocio**: a qué tipo de siniestros aplica. Puede ser Hogar, Comercial, Industrial, etc.
- **Acción vinculada**: a qué tipo de gestión pertenece. Por ejemplo: Aviso de Asignación (AVI), Coordinación de Inspección (CIN), Notificación de Antecedentes (SOL), etc.
- **Asunto del e-mail**.
- **Cuerpo del e-mail**.
- **Estado**: activa o inactiva. Solo las activas se pueden usar.

El asunto y el cuerpo pueden contener **marcadores** que se reemplazan solos. Por ejemplo:

```
Estimado [NOMBRE_ASEGURADO]:

Le informamos que el siniestro [NUM_LIQUIDACION] fue asignado al inspector [NOMBRE_INSPECTOR].
```

Cuando se envía el correo, el sistema busca esos marcadores y los cambia por los datos reales del siniestro.

---

## 4. ¿En qué momentos se puede usar una plantilla?

### 4.1 Envío manual desde una gestión de siniestro

Cuando un usuario está trabajando en una gestión —por ejemplo, una Coordinación de Inspección— y esa gestión tiene plantillas de e-mail activas, aparecerá un **botón de e-mail**. Al apretarlo, el sistema muestra las plantillas disponibles, el usuario elige una, se carga el asunto y el cuerpo ya completados con los datos, escribe a quién se lo envía y aprieta **Enviar**.

Ejemplo: después de coordinar una inspección, el ajustador abre la plantilla, elige "Confirmación de coordinación", el sistema carga la fecha, la dirección y el nombre del inspector, y solo debe agregar el correo del asegurado.

### 4.2 Envío automático al crear una gestión

Algunas gestiones se configuran para que, apenas se crean por el workflow, se emitan y envíen solas. Para eso se necesitan dos switches:

- **Completar automáticamente**: la gestión pasa a emitida sin que un usuario tenga que hacerlo manualmente.
- **Enviar e-mail automáticamente**: además de emitirse, envía un e-mail usando la plantilla que se le haya elegido.

Ejemplo: el Aviso de Asignación. El workflow crea la gestión, la emite y, como tiene configurado el envío automático, dispara el correo de aviso al asegurado, al corredor o a quien corresponda.

---

## 5. ¿Cómo se vincula una plantilla a una acción?

Cada plantilla se asocia a un **tipo de acción** (`action_template`), por ejemplo `AVI`, `CIN` o `SOL`. Eso significa que, al usar una acción de ese tipo, el sistema mostrará solo las plantillas que correspondan.

Además, se filtran por la **línea de negocio** del siniestro. Si el siniestro es de la línea Comercial, solo se verán las plantillas creadas para Comercial.

También se puede crear una plantilla nueva directamente desde la configuración de una acción. Así no hay que saltar a otra pantalla.

---

## 6. ¿Qué son los marcadores y cómo funcionan?

Los **marcadores** son palabras clave escritas entre corchetes o signos de mayor/menor, por ejemplo `[NOMBRE_ASEGURADO]` o `<nombre_asegurado>`. El sistema los reconoce y los cambia por datos reales del siniestro.

Los datos que se pueden usar son los mismos que ya existen en el sistema:

- Datos del siniestro: número, liquidación, dirección, fecha del evento.
- Datos de la póliza.
- Datos de las personas: asegurado, inspector, liquidador, asistente.
- Datos de la gestión que se está viendo: fecha de inspección, motivo, resultado, etc.
- Datos de la sesión de inspección, si aplica.

El sistema reemplaza todos los marcadores que conozca. Si falta alguno, deja el espacio vacío para evitar errores.

---

## 7. ¿Qué ve el usuario al enviar un e-mail?

Cuando el usuario aprieta el botón de e-mail dentro de una gestión, se le muestra una ventana con:

1. Una lista de plantillas activas para esa acción.
2. El **asunto** ya completado con los datos del siniestro.
3. El **cuerpo** ya completado con los datos del siniestro.
4. Un campo para escribir a quién se envía (`Para`).
5. Campos opcionales para `CC` y `CCO`.
6. Un botón para enviar.

El usuario solo debe elegir la plantilla, completar el destinatario y apretar enviar. El sistema se encarga del resto.

---

## 8. ¿Se guarda lo que se envió?

Sí. Cada e-mail enviado queda registrado en un **historial** vinculado a la gestión del siniestro. Allí se puede ver:

- Fecha y hora de envío.
- Quién lo envió (o si fue automático).
- Destinatario.
- Asunto y cuerpo final.
- Estado: enviado, fallido, en cola.

Esto permite auditar los envíos y reintentar si alguno falló.

---

## 9. ¿Cuándo entra en vigor una plantilla?

Una plantilla entra en vigor cuando está **activa** y cumple tres condiciones:

1. Está vinculada a una acción (`AVI`, `CIN`, etc.).
2. Está asociada a la línea de negocio del siniestro.
3. La acción correspondiente está configurada para usar plantillas de e-mail.

Desde ese momento, toda gestión de ese tipo y línea mostrará el botón de e-mail con esa plantilla disponible.

Si la plantilla está configurada para envío automático, se enviará sola apenas se cree y emita la gestión.

---

## 10. ¿Qué tipos de acciones se benefician?

### 10.1 Acciones totalmente automáticas

Ejemplo: **Aviso de Asignación (AVI)**.

- El workflow crea la acción.
- Se emite automáticamente.
- Se envía el e-mail de aviso automáticamente.

El usuario no interviene.

### 10.2 Acciones manuales que requieren e-mail después

Ejemplo: **Coordinación de Inspección (CIN)**.

- El ajustador coordina la inspección.
- Cuando tiene la fecha, hora e inspector, aprieta el botón de e-mail.
- Elige la plantilla, revisa el texto, completa el destinatario y envía.

---

## 11. Resumen del flujo para el usuario final

### Crear una plantilla

1. Va a **Catálogos → Gestiones → Plantillas de E-mail**.
2. Crea una nueva plantilla.
3. Le pone nombre, línea de negocio y acción vinculada.
4. Escribe el asunto y el cuerpo con marcadores.
5. La activa.

### Usar una plantilla

1. Abre un siniestro.
2. Entra a la gestión correspondiente (por ejemplo, CIN).
3. Aprieta el botón **E-mail**.
4. Elige la plantilla.
5. Revisa el asunto y cuerpo completados.
6. Escribe el destinatario.
7. Aprieta **Enviar**.

### Configurar envío automático

1. Va a la configuración del tipo de acción (por ejemplo, AVI).
2. Activa **Completar automáticamente**.
3. Activa **Enviar e-mail automáticamente**.
4. Selecciona la plantilla que se enviará.
5. A partir de ese momento, cada vez que el workflow cree una AVI, se emitirá y enviará el correo sola.

---

## 12. Diferencia clave con plantillas de documentos

Las plantillas de documentos generan un archivo Word, Excel o PowerPoint que se descarga. Las plantillas de e-mail generan un correo electrónico listo para enviar. Ambas usan los mismos marcadores, pero el resultado final es distinto: uno es un archivo, el otro es un e-mail.

---

## 13. Preguntas frecuentes

**¿Puedo tener varias plantillas para la misma acción?**
Sí. Por ejemplo, para CIN puedes tener "Confirmación de coordinación", "Reagendamiento" y "Cancelación". Cada una es una plantilla distinta.

**¿Qué pasa si un marcador no tiene dato?**
El sistema lo deja vacío. No se muestra el marcador al destinatario.

**¿Puedo editar el asunto o cuerpo antes de enviar?**
En la primera versión el asunto y cuerpo se cargan desde la plantilla. El destinatario sí se edita. Si se necesita, se puede habilitar la edición del cuerpo más adelante.

**¿Qué proveedor de e-mail se usa?**
Se puede conectar SendGrid, Resend o SMTP. Eso se decide en la configuración de la aplicación.

**¿Los envíos automáticos aparecen como hechos por el sistema?**
Sí. En el historial se marca que el envío fue automático, generado por el workflow.

---

## 14. Próximos pasos resumidos

1. Crear el catálogo de **Plantillas de E-mail**.
2. Permitir vincular plantillas a acciones y líneas de negocio.
3. Agregar los switches de **Completar automáticamente** y **E-mail automático** en las acciones.
4. Mostrar el botón de **E-mail** dentro de las gestiones.
5. Crear la ventana de envío con carga automática de datos.
6. Guardar un historial de e-mails enviados por gestión.

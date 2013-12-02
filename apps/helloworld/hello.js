console.log("Hello World!");

setTimeout(function () {
    console.log("Bye!");
}, 100000);

process.on("exit", function (code, signal) {
   console.log("exited"); 
});

process.on("SIGTERM", function () {
   process.exit(1);
});
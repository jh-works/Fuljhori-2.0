async function test() {
  try {
    const res = await fetch("http://localhost:3000/src/app.js");
    const text = await res.text();
    console.log("STATUS:", res.status);
    console.log(text.substring(0, 1000));
  } catch (e) {
    console.error(e);
  }
}
test();
